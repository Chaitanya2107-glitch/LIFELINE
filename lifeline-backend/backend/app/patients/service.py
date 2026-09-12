from datetime import datetime, timedelta, timezone

from app.database.supabase import supabase
from app.auth.security import pwd_context
from app.config.settings import settings
from app.models.patient import PatientRecord
from app.utils.patient_code import generate_patient_code
from app.utils.logger import logger


# ──────────────────────────────────────────────
# Patient CRUD
# ──────────────────────────────────────────────

def create_patient(
    name: str,
    phone: str,
    date_of_birth: str | None = None,
    created_by: int | None = None,
    password: str | None = None,
    email: str | None = None,
) -> PatientRecord:
    """Insert a new patient row and return it.

    Retries up to 3 times on patient_code uniqueness collision.
    Raises RuntimeError if all attempts fail (astronomically unlikely).
    """
    max_attempts = 3

    for attempt in range(1, max_attempts + 1):
        code = generate_patient_code()

        try:
            payload: dict = {
                "patient_code": code,
                "name": name,
                "phone": phone,
            }
            if created_by is not None:
                payload["created_by"] = created_by
            if date_of_birth is not None:
                payload["date_of_birth"] = date_of_birth
            if password is not None:
                payload["password_hash"] = password
            if email is not None:
                payload["email"] = email

            response = (
                supabase
                .table("patients")
                .insert(payload)
                .execute()
            )

            logger.info(
                "Patient created | code={} | created_by={}",
                code,
                created_by,
            )
            return response.data[0]

        except Exception as e:
            # Supabase raises an exception whose string contains the
            # Postgres unique-violation code (23505) on duplicate patient_code.
            if "23505" in str(e) and attempt < max_attempts:
                logger.warning(
                    "patient_code collision on {} — retrying ({}/{})",
                    code,
                    attempt,
                    max_attempts,
                )
                continue
            raise

    raise RuntimeError(  # pragma: no cover
        "Failed to generate a unique patient_code after "
        f"{max_attempts} attempts."
    )


def get_patient_by_id(patient_id: str) -> PatientRecord | None:
    """Return a patient row by UUID, or None if not found."""
    response = (
        supabase
        .table("patients")
        .select("*")
        .eq("id", patient_id)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


def get_patient_by_code(patient_code: str) -> PatientRecord | None:
    """Return a patient row by patient_code, or None if not found."""
    response = (
        supabase
        .table("patients")
        .select("*")
        .eq("patient_code", patient_code)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


# ──────────────────────────────────────────────
# OTP
# ──────────────────────────────────────────────

def create_otp_session(patient_id: str) -> str:
    """Generate a 6-digit OTP, store its bcrypt hash, and return the plaintext.

    The plaintext OTP is returned to the route so it can be included in the
    API response for demo purposes.  In production this would be sent via SMS.

    The session expires after PATIENT_JWT_EXPIRE_MINUTES minutes (default 15).
    """
    import random as _random

    otp_plaintext = f"{_random.randint(0, 999999):06d}"
    otp_hash = pwd_context.hash(otp_plaintext)

    expires_at = (
        datetime.now(tz=timezone.utc)
        + timedelta(minutes=settings.PATIENT_JWT_EXPIRE_MINUTES)
    ).isoformat()

    supabase.table("otp_sessions").insert({
        "patient_id": patient_id,
        "otp_hash": otp_hash,
        "expires_at": expires_at,
        "used": False,
    }).execute()

    logger.info("OTP session created | patient_id={}", patient_id)

    return otp_plaintext


def verify_otp(patient_code: str, otp: str) -> PatientRecord | None:
    """Verify an OTP for the patient identified by patient_code.

    Looks up all active (unused, unexpired) OTP sessions for the patient and
    bcrypt-verifies the supplied OTP against each stored hash.

    On success:
      - marks the matched session as used
      - returns the patient record

    On failure (no match, all expired, patient not found):
      - returns None
    """
    patient = get_patient_by_code(patient_code)
    if patient is None:
        return None

    now_iso = datetime.now(tz=timezone.utc).isoformat()

    # Fetch all active sessions — expired and used rows are excluded at DB level
    sessions_response = (
        supabase
        .table("otp_sessions")
        .select("id, otp_hash")
        .eq("patient_id", patient["id"])
        .eq("used", False)
        .gt("expires_at", now_iso)
        .execute()
    )

    for session in sessions_response.data:
        if pwd_context.verify(otp, session["otp_hash"]):
            # Mark this session as used immediately to prevent replay
            supabase.table("otp_sessions").update(
                {"used": True}
            ).eq("id", session["id"]).execute()

            logger.info(
                "OTP verified | patient_id={} | session_id={}",
                patient["id"],
                session["id"],
            )
            return patient

    logger.warning(
        "OTP verification failed | patient_code={}", patient_code
    )
    return None
