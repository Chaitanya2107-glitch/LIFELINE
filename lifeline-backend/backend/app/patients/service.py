from app.database.supabase import supabase
from app.models.patient import PatientRecord
from app.utils.patient_code import generate_patient_code
from app.utils.qr_token import generate_qr_token
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
# Emergency QR token
# ──────────────────────────────────────────────

def get_or_create_emergency_qr_token(patient_id: str) -> str:
    """Return the patient's emergency QR token, generating one if it doesn't exist yet.

    Retries up to 3 times on a unique-constraint collision (23505).
    Token is stored in patients.emergency_qr_token.
    """
    # Fast path: token already set
    row = (
        supabase
        .table("patients")
        .select("emergency_qr_token")
        .eq("id", patient_id)
        .limit(1)
        .execute()
    )
    if row.data and row.data[0].get("emergency_qr_token"):
        return row.data[0]["emergency_qr_token"]

    # Slow path: generate and persist
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        token = generate_qr_token()
        try:
            result = (
                supabase
                .table("patients")
                .update({"emergency_qr_token": token})
                .eq("id", patient_id)
                .execute()
            )
            logger.info("emergency_qr_token generated | patient_id={}", patient_id)
            return result.data[0]["emergency_qr_token"]
        except Exception as e:
            if "23505" in str(e) and attempt < max_attempts:
                logger.warning(
                    "emergency_qr_token collision — retrying ({}/{})", attempt, max_attempts
                )
                continue
            raise

    raise RuntimeError(  # pragma: no cover
        f"Failed to generate a unique emergency_qr_token after {max_attempts} attempts."
    )


def regenerate_emergency_qr_token(patient_id: str) -> str:
    """Always generate a fresh token, overwriting the existing one.

    The old token becomes invalid immediately — any QR codes pointing to it
    will receive a 404 on the public endpoint.
    Retries up to 3 times on a unique-constraint collision (23505).
    """
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        token = generate_qr_token()
        try:
            result = (
                supabase
                .table("patients")
                .update({"emergency_qr_token": token})
                .eq("id", patient_id)
                .execute()
            )
            logger.info("emergency_qr_token regenerated | patient_id={}", patient_id)
            return result.data[0]["emergency_qr_token"]
        except Exception as e:
            if "23505" in str(e) and attempt < max_attempts:
                logger.warning(
                    "emergency_qr_token collision on regenerate — retrying ({}/{})",
                    attempt,
                    max_attempts,
                )
                continue
            raise

    raise RuntimeError(  # pragma: no cover
        f"Failed to regenerate a unique emergency_qr_token after {max_attempts} attempts."
    )


def get_emergency_info_by_token(token: str) -> dict | None:
    """Look up a patient by emergency_qr_token and return ONLY safe emergency fields.

    Returns None if the token does not match any patient.

    The returned dict contains ONLY:
      name, blood_group, date_of_birth, conditions, emergency_contacts, allergies

    It NEVER contains: id, patient_code, email, phone, password_hash,
    diagnoses, medicines, lab_values, or any medical_records row details.
    """
    row = (
        supabase
        .table("patients")
        .select("id, name, blood_group, date_of_birth, conditions, emergency_contacts")
        .eq("emergency_qr_token", token)
        .limit(1)
        .execute()
    )
    if not row.data:
        return None

    patient = row.data[0]
    patient_id = patient.pop("id")  # used only to fetch allergies; not returned

    # Aggregate unique allergies from all medical_records for this patient
    records_resp = (
        supabase
        .table("medical_records")
        .select("allergies")
        .eq("patient_id", patient_id)
        .execute()
    )
    allergy_set: set[str] = set()
    for rec in (records_resp.data or []):
        for a in (rec.get("allergies") or []):
            if isinstance(a, str) and a.strip():
                allergy_set.add(a.strip())

    patient["allergies"] = sorted(allergy_set)
    patient.setdefault("conditions", [])
    patient.setdefault("emergency_contacts", [])
    return patient
