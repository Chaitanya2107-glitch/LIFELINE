from app.database.supabase import supabase
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


