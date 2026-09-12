from app.services.medical_record_service import get_all_medical_records
from app.ai.providers.groq_provider import generate
from app.ai.prompts import DOCTOR_SUMMARY_PROMPT


def _normalise_items(items: list) -> list[str]:
    """Normalize a list that may contain strings or structured dicts to strings.

    For dict items (e.g. MedicineItem serialised by Supabase), the ``name``
    key is preferred.  Plain strings pass through unchanged.  Anything else
    is coerced with ``str()`` as a last resort.
    """
    result = []
    for item in items:
        if isinstance(item, str):
            result.append(item)
        elif isinstance(item, dict):
            result.append(item.get("name") or str(item))
        else:
            result.append(str(item))
    return result


def generate_summary(patient_id: str):

    records = get_all_medical_records(patient_id)

    if not records:
        return "No medical records found."

    diagnoses = set()
    medicines = set()
    allergies = set()
    doctors = set()
    hospitals = set()

    for record in records:

        diagnoses.update(record.get("diagnosis", []))
        medicines.update(_normalise_items(record.get("medicines", [])))
        allergies.update(record.get("allergies", []))

        if record.get("doctor"):
            doctors.add(record["doctor"])

        if record.get("hospital"):
            hospitals.add(record["hospital"])

    structured_data = f"""
Verified Medical Information

Diagnoses:
{chr(10).join("- " + d for d in sorted(diagnoses)) or "Not available"}

Medications:
{chr(10).join("- " + m for m in sorted(medicines)) or "Not available"}

Allergies:
{chr(10).join("- " + a for a in sorted(allergies)) or "Not available"}

Doctors:
{chr(10).join("- " + d for d in sorted(doctors)) or "Not available"}

Hospitals:
{chr(10).join("- " + h for h in sorted(hospitals)) or "Not available"}
"""

    prompt = f"""
{DOCTOR_SUMMARY_PROMPT}

Verified Medical Information:

{structured_data}
"""

    return generate(prompt)
