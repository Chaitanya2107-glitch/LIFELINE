from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.schemas import TokenResponse
from app.auth.security import (
    create_access_token,
    hash_password,
    require_patient,
    require_staff,
    verify_password,
)
from app.config.settings import settings
from app.database.supabase import supabase
from app.patients import service as patient_service
from app.patients.schemas import (
    CreatePatientRequest,
    OtpRequestRequest,
    OtpRequestResponse,
    OtpVerifyRequest,
    OtpVerifyResponse,
    PatientLoginRequest,
    PatientProfileResponse,
    PatientProfileUpdate,
    PatientRegisterRequest,
    PatientRegisterResponse,
    PatientResponse,
)
from app.services.audit_service import write_access_log
from app.utils.limiter import limiter

# ──────────────────────────────────────────────
# Router 1: /patients — staff-only CRUD
# ──────────────────────────────────────────────

patients_router = APIRouter(
    prefix="/patients",
    tags=["Patients"],
)


@patients_router.post("/", response_model=PatientResponse)
def create_patient(
    body: CreatePatientRequest,
    current_user: dict = Depends(require_staff),
):
    """Create a new patient record.

    Accessible by: doctor, clerk.
    The system generates a unique LFL-XXXXXX patient code.
    """
    patient = patient_service.create_patient(
        name=body.name,
        phone=body.phone,
        date_of_birth=body.date_of_birth,
        created_by=current_user["user_id"],
    )
    return patient


@patients_router.get("/code/{patient_code}", response_model=PatientResponse)
def get_patient_by_code(
    patient_code: str,
    current_user: dict = Depends(require_staff),
):
    """Look up a patient by their LFL-XXXXXX code.

    Accessible by: doctor, clerk.
    This route is declared before /{patient_id} to prevent FastAPI
    from matching the literal string 'code' as a UUID.
    """
    patient = patient_service.get_patient_by_code(patient_code)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Audit: log only on successful lookup (not on 404).
    # patient_code is the patient's own public identifier — not sensitive clinical data.
    write_access_log(
        actor_role=current_user["role"],
        action="patient_searched",
        actor_user_id=current_user["user_id"],
        patient_id=patient["id"],
        metadata={"patient_code": patient_code},
    )

    return patient


@patients_router.get("/{patient_id}", response_model=PatientResponse)
def get_patient_by_id(
    patient_id: str,
    current_user: dict = Depends(require_staff),
):
    """Look up a patient by their UUID.

    Accessible by: doctor, clerk.
    """
    patient = patient_service.get_patient_by_id(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Audit: log only on successful lookup (not on 404).
    write_access_log(
        actor_role=current_user["role"],
        action="patient_searched",
        actor_user_id=current_user["user_id"],
        patient_id=patient["id"],
        metadata={"lookup": "by_id"},
    )

    return patient


# ──────────────────────────────────────────────
# Router 2: /patient — public OTP flow
# ──────────────────────────────────────────────

patient_otp_router = APIRouter(
    prefix="/patient",
    tags=["Patient Authentication"],
)


@patient_otp_router.post("/request-otp", response_model=OtpRequestResponse)
@limiter.limit("5/minute")
def request_otp(request: Request, body: OtpRequestRequest):
    """Request an OTP for patient login.

    No authentication required — the patient identifies themselves by code.
    Returns the OTP plaintext in the response (demo mode; production → SMS).
    Returns 404 if the patient_code is not recognised.
    """
    patient = patient_service.get_patient_by_code(body.patient_code)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    otp = patient_service.create_otp_session(patient["id"])

    return OtpRequestResponse(
        patient_code=body.patient_code,
        otp=otp,
        expires_in_minutes=settings.PATIENT_JWT_EXPIRE_MINUTES,
    )


@patient_otp_router.post("/verify-otp", response_model=OtpVerifyResponse)
@limiter.limit("10/minute")
def verify_otp(request: Request, body: OtpVerifyRequest):
    """Verify an OTP and issue a short-lived patient session JWT.

    No authentication required.
    Returns 401 if the OTP is invalid or expired.
    The issued JWT contains: patient_id (UUID), role='patient', sub=patient_code.
    Expires in PATIENT_JWT_EXPIRE_MINUTES (default 15 min).
    """
    patient = patient_service.verify_otp(body.patient_code, body.otp)
    if patient is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired OTP",
        )

    token = create_access_token(
        data={
            "sub": patient["patient_code"],
            "patient_id": patient["id"],
            "role": "patient",
        },
        expire_minutes=settings.PATIENT_JWT_EXPIRE_MINUTES,
    )

    return OtpVerifyResponse(
        access_token=token,
        token_type="bearer",
        expires_in_minutes=settings.PATIENT_JWT_EXPIRE_MINUTES,
    )


@patient_otp_router.post("/register", response_model=PatientRegisterResponse, status_code=201)
@limiter.limit("3/minute")
def patient_register(request: Request, body: PatientRegisterRequest):
    """Patient self-registration — creates a new account and returns the generated LFL code.

    Public — no authentication required.
    The backend generates a unique LFL-XXXXXX code for the new patient.
    - 409 if the phone number is already registered
    """
    # Check for duplicate phone
    existing = (
        supabase.table("patients")
        .select("id")
        .eq("phone", body.phone)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Phone number already registered")

    patient = patient_service.create_patient(
        name=body.name,
        phone=body.phone,
        date_of_birth=body.date_of_birth,
        password=hash_password(body.password),
        email=body.email,
    )
    return patient


@patient_otp_router.post("/login", response_model=TokenResponse)
def patient_login(body: PatientLoginRequest):
    """Authenticate a patient with LFL code + password and issue a JWT.

    Public — no authentication required.
    - 401 if the LFL code is not found, account is unclaimed, or password is wrong
    Token expiry: JWT_EXPIRE_MINUTES (60 min), same as staff — not the 15-min OTP token.
    """
    patient = patient_service.get_patient_by_code(body.lfl_code)
    if patient is None or not patient.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(body.password, patient["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        data={
            "sub": patient["patient_code"],
            "patient_id": patient["id"],
            "role": "patient",
        },
        expire_minutes=settings.JWT_EXPIRE_MINUTES,
    )

    return {"access_token": token, "token_type": "bearer"}


@patient_otp_router.get("/profile", response_model=PatientProfileResponse)
def get_patient_profile(current_user: dict = Depends(require_patient)):
    """Return the full profile for the authenticated patient.

    Requires a patient JWT (role='patient').
    Uses patient_id from the token — no query param needed.
    """
    patient = patient_service.get_patient_by_id(current_user["patient_id"])
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient.pop("password_hash", None)
    patient.setdefault("emergency_contacts", [])
    patient.setdefault("conditions", [])
    return patient


@patient_otp_router.patch("/profile", response_model=PatientProfileResponse)
def update_patient_profile(
    body: PatientProfileUpdate,
    current_user: dict = Depends(require_patient),
):
    """Partially update the authenticated patient's profile.

    Requires a patient JWT (role='patient').
    Only fields explicitly provided in the body are updated.
    """
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided")

    result = (
        supabase.table("patients")
        .update(updates)
        .eq("id", current_user["patient_id"])
        .execute()
    )

    patient = result.data[0]
    patient.pop("password_hash", None)
    patient.setdefault("emergency_contacts", [])
    patient.setdefault("conditions", [])
    return patient
