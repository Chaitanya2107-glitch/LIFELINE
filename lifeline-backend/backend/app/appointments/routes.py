"""Appointments routes.

Route declaration order (literals before parameterised):

  POST   /appointments/request-otp  -- doctor/clerk: request patient OTP
  POST   /appointments/verify-otp   -- doctor/clerk: verify patient OTP -> appt_token
  GET    /appointments               -- patient: own; doctor: own
  POST   /appointments               -- doctor only, requires consent + OTP
  PATCH  /appointments/{id}          -- update status/notes/location (owner only)
  DELETE /appointments/{id}          -- cancel (sets status='cancelled', owner only)
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from app.appointments import service as appt_service
from app.appointments.schemas import (
    Appointment,
    ApptOtpRequestBody,
    ApptOtpRequestResponse,
    ApptOtpVerifyBody,
    ApptOtpVerifyResponse,
    CreateAppointmentBody,
    UpdateAppointmentBody,
)
from app.auth.security import (
    create_access_token,
    verify_access_token,
    get_current_user,
    require_doctor,
    require_staff,
)
from app.patients.service import get_patient_by_code, create_otp_session, verify_otp
from app.services.medical_record_service import check_doctor_consent
from app.utils.limiter import limiter

appointments_router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
)

# Expiry for the scoped appointment-auth token (minutes).
_APPT_TOKEN_EXPIRE_MINUTES = 10

# Sentinel role value used only in appointment-auth tokens.
# Never accepted by require_staff / require_doctor / require_patient.
_APPT_AUTH_ROLE = "appt_auth"


# ── POST /appointments/request-otp ────────────────────────────────────────────

@appointments_router.post("/request-otp", response_model=ApptOtpRequestResponse)
@limiter.limit("5/minute")
def appt_request_otp(
    request: Request,
    body: ApptOtpRequestBody,
    current_user: dict = Depends(require_staff),
):
    """Initiate patient OTP authorisation for a pending appointment.

    Accessible by: doctor, clerk.
    Looks up the patient by LFL code, generates a 6-digit OTP via the existing
    otp_sessions mechanism, and returns it in the response body (demo mode —
    in production this would be sent via SMS to the patient).

    The OTP must be verified via POST /appointments/verify-otp before the
    appointment can be created.  It is single-use, bcrypt-hashed at rest,
    and expires after PATIENT_JWT_EXPIRE_MINUTES minutes (default 15).
    """
    patient = get_patient_by_code(body.patient_code)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    otp = create_otp_session(patient["id"])

    return ApptOtpRequestResponse(
        patient_code=body.patient_code,
        otp=otp,
        expires_in_minutes=_APPT_TOKEN_EXPIRE_MINUTES,
    )


# ── POST /appointments/verify-otp ─────────────────────────────────────────────

@appointments_router.post("/verify-otp", response_model=ApptOtpVerifyResponse)
@limiter.limit("10/minute")
def appt_verify_otp(
    request: Request,
    body: ApptOtpVerifyBody,
    current_user: dict = Depends(require_staff),
):
    """Verify the patient OTP and issue a short-lived appointment-auth token.

    Accessible by: doctor, clerk.
    Calls the existing verify_otp() service (marks the session used on success —
    replay is impossible).  On success, returns a JWT that is:
      - Scoped exclusively to creating one appointment for this patient
        (role='appt_auth')
      - Valid for _APPT_TOKEN_EXPIRE_MINUTES minutes (default 10)
      - Not accepted by any other endpoint

    The OTP plaintext is NOT stored in audit logs, access logs, or the JWT.
    The patient_id UUID is embedded in the token so POST /appointments can
    verify it matches the supplied patient_id without a second DB lookup.
    """
    patient = verify_otp(body.patient_code, body.otp)
    if patient is None:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    appt_token = create_access_token(
        data={
            "sub": "appt_auth",
            "role": _APPT_AUTH_ROLE,
            "patient_id": patient["id"],
        },
        expire_minutes=_APPT_TOKEN_EXPIRE_MINUTES,
    )

    return ApptOtpVerifyResponse(
        appt_token=appt_token,
        expires_in_minutes=_APPT_TOKEN_EXPIRE_MINUTES,
    )


# ── GET /appointments ──────────────────────────────────────────────────────────

@appointments_router.get("", response_model=list[Appointment])
def get_appointments(
    current_user: dict = Depends(get_current_user),
):
    """Return appointments for the authenticated caller.

    - Patient token: returns all appointments where patient_id matches JWT.
    - Doctor token:  returns all appointments where doctor_id matches JWT.
    - Clerk token:   403.

    Note: doctor GET is NOT consent-gated — a doctor sees their own
    appointment schedule regardless of patient consent status.
    """
    role = current_user.get("role")

    if role == "patient":
        return appt_service.get_appointments(
            role="patient",
            user_id=None,
            patient_id=current_user["patient_id"],
        )

    if role == "doctor":
        return appt_service.get_appointments(
            role="doctor",
            user_id=current_user["user_id"],
        )

    raise HTTPException(status_code=403, detail="Access denied")


# ── POST /appointments ─────────────────────────────────────────────────────────

@appointments_router.post("", response_model=Appointment, status_code=201)
def create_appointment(
    body: CreateAppointmentBody,
    current_user: dict = Depends(get_current_user),
):
    """Doctor creates an appointment for a patient.

    Accessible by: doctor only.
    Requires ALL of:
      1. A valid doctor JWT (via get_current_user, role check below).
      2. An approved, unexpired consent for the target patient.
      3. A valid appt_token issued by POST /appointments/verify-otp —
         proves the patient authorised this specific appointment via OTP.

    The appt_token is verified server-side:
      - Decoded with the same JWT secret.
      - role must be exactly 'appt_auth' (not accepted elsewhere).
      - patient_id in the token must match the body's patient_id.
      - Token must not be expired (10-minute window).

    The OTP and token are never stored in audit metadata.
    """
    role = current_user.get("role")

    if role != "doctor":
        raise HTTPException(
            status_code=403,
            detail="Only doctors can create appointments",
        )

    # ── Validate appointment-auth token ───────────────────────────────────────
    token_payload = verify_access_token(body.appt_token)
    if token_payload is None:
        raise HTTPException(
            status_code=401,
            detail="Appointment authorisation token is invalid or expired",
        )
    if token_payload.get("role") != _APPT_AUTH_ROLE:
        raise HTTPException(
            status_code=403,
            detail="Invalid appointment authorisation token",
        )
    if token_payload.get("patient_id") != body.patient_id:
        raise HTTPException(
            status_code=403,
            detail="Appointment token patient does not match the supplied patient_id",
        )

    doctor_id = current_user["user_id"]

    if not check_doctor_consent(doctor_id, body.patient_id):
        raise HTTPException(
            status_code=403,
            detail="No approved consent found for this patient",
        )

    return appt_service.create_appointment(
        doctor_id=doctor_id,
        data=body.model_dump(exclude={"appt_token"}),
    )


# ── PATCH /appointments/{id} ───────────────────────────────────────────────────

@appointments_router.patch("/{appt_id}", response_model=Appointment)
def update_appointment(
    appt_id: str,
    body: UpdateAppointmentBody,
    current_user: dict = Depends(get_current_user),
):
    """Update status, notes, and/or location on an appointment.

    - Patient token: must own the appointment (patient_id matches).
    - Doctor token:  must own the appointment (doctor_id matches).
    - Clerk token:   403.
    """
    role = current_user.get("role")

    if role == "clerk":
        raise HTTPException(status_code=403, detail="Access denied")

    if role not in {"patient", "doctor"}:
        raise HTTPException(status_code=403, detail="Access denied")

    user_id = (
        current_user["patient_id"] if role == "patient"
        else current_user["user_id"]
    )

    result = appt_service.update_appointment(
        appt_id=appt_id,
        role=role,
        user_id=user_id,
        payload=body.model_dump(exclude_unset=True),
    )

    if result == "not_found":
        raise HTTPException(status_code=404, detail="Appointment not found")
    if result == "forbidden":
        raise HTTPException(status_code=403, detail="Access denied")

    return result


# ── DELETE /appointments/{id} ──────────────────────────────────────────────────

@appointments_router.delete("/{appt_id}", response_model=Appointment)
def cancel_appointment(
    appt_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Cancel an appointment (sets status to 'cancelled').

    - Patient token: must own the appointment.
    - Doctor token:  must own the appointment.
    - Clerk token:   403.
    """
    role = current_user.get("role")

    if role == "clerk":
        raise HTTPException(status_code=403, detail="Access denied")

    if role not in {"patient", "doctor"}:
        raise HTTPException(status_code=403, detail="Access denied")

    user_id = (
        current_user["patient_id"] if role == "patient"
        else current_user["user_id"]
    )

    result = appt_service.cancel_appointment(
        appt_id=appt_id,
        role=role,
        user_id=user_id,
    )

    if result == "not_found":
        raise HTTPException(status_code=404, detail="Appointment not found")
    if result == "forbidden":
        raise HTTPException(status_code=403, detail="Access denied")

    return result
