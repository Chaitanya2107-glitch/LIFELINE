"""Appointments routes.

Route declaration order (literals before parameterised):

  GET    /appointments               -- patient: own; doctor: own
  POST   /appointments               -- doctor only (requires consent); status='pending'
  PATCH  /appointments/{id}          -- update status/notes/location (owner only, role-scoped)
  DELETE /appointments/{id}          -- cancel (sets status='cancelled', owner only)

Approval flow (replaces OTP):
  1. Doctor calls POST /appointments  -> appointment created with status='pending'
  2. Patient calls PATCH /appointments/{id} with status='upcoming' to approve,
     or status='rejected' to decline.
  3. Doctor may mark 'completed' or 'cancelled' on their own appointments.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.appointments import service as appt_service
from app.appointments.schemas import (
    Appointment,
    CreateAppointmentBody,
    UpdateAppointmentBody,
)
from app.auth.security import (
    get_current_user,
)
from app.services.medical_record_service import check_doctor_consent

appointments_router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
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
    """Doctor proposes an appointment for a patient.

    Accessible by: doctor only.
    Requires:
      1. A valid doctor JWT.
      2. An approved, unexpired consent for the target patient.

    The appointment is created with status='pending'.  The patient must
    approve it (PATCH /appointments/{id} status='upcoming') before it
    is confirmed.  No OTP round-trip is required.
    """
    role = current_user.get("role")

    if role != "doctor":
        raise HTTPException(
            status_code=403,
            detail="Only doctors can create appointments",
        )

    doctor_id = current_user["user_id"]

    if not check_doctor_consent(doctor_id, body.patient_id):
        raise HTTPException(
            status_code=403,
            detail="No approved consent found for this patient",
        )

    return appt_service.create_appointment(
        doctor_id=doctor_id,
        data=body.model_dump(),
    )


# ── PATCH /appointments/{id} ───────────────────────────────────────────────────

@appointments_router.patch("/{appt_id}", response_model=Appointment)
def update_appointment(
    appt_id: str,
    body: UpdateAppointmentBody,
    current_user: dict = Depends(get_current_user),
):
    """Update status, notes, and/or location on an appointment.

    Role-based status transition rules:
      - Patient: may set status to 'upcoming' (approve) or 'rejected' only when
                 current status is 'pending'.  May also set 'cancelled'.
      - Doctor:  may set status to 'completed' or 'cancelled'.
                 Cannot move 'pending' -> 'upcoming' (that is the patient's action).
      - Clerk:   403.

    Ownership is always enforced: patient must own patient_id, doctor must own doctor_id.
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

    # Enforce role-based status transition rules before hitting the service.
    requested_status = body.status
    if requested_status is not None:
        if role == "doctor" and requested_status in {"upcoming", "rejected"}:
            raise HTTPException(
                status_code=403,
                detail="Doctors cannot approve or reject appointments — that is the patient's action",
            )
        if role == "patient" and requested_status in {"completed"}:
            raise HTTPException(
                status_code=403,
                detail="Patients cannot mark appointments as completed",
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
    if result == "invalid_transition":
        raise HTTPException(
            status_code=409,
            detail="This status change is not allowed for the current appointment state",
        )

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
