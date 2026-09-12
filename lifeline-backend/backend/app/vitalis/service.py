from app.services.medical_record_service import get_all_medical_records
from app.summary.service import generate_summary
from app.ai.providers.groq_provider import generate


def _format_medicines(medicines: list) -> str:
    """Render a medicines list (strings or structured dicts) as a readable string.

    For dict items the name is shown first, followed by dosage/frequency/duration
    if present.  Plain strings pass through as-is.
    """
    if not medicines:
        return "None"
    parts = []
    for m in medicines:
        if isinstance(m, dict):
            name = m.get("name", "")
            extras = ", ".join(
                f"{k}: {v}"
                for k in ("dosage", "frequency", "duration")
                if (v := m.get(k))
            )
            parts.append(f"{name} ({extras})" if extras else name)
        else:
            parts.append(str(m))
    return ", ".join(parts)


def generate_vitalis_response(
    patient_id: str,
    question: str,
):

    records = get_all_medical_records(patient_id)

    if not records:
        return "No medical records found."

    summary = generate_summary(patient_id)

    context = f"""
Patient Medical Summary:

{summary}


Medical Records:

"""

    for record in records:
        context += f"""
Date:
{record.get("created_at")}

Doctor:
{record.get("doctor")}

Hospital:
{record.get("hospital")}

Diagnosis:
{record.get("diagnosis")}

Medicines:
{_format_medicines(record.get("medicines", []))}

---

"""

    prompt = f"""
You are Vitalis, a medical assistant.

Use only the provided patient information.

Do not create medical facts that are not present.

Do not answer using external knowledge about the patient's history.

If the answer is unavailable, clearly say:
"I don't have enough information in your medical records."

Patient Information:

{context}

Question:

{question}

Answer:
"""

    return generate(prompt)
