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

    if records:
        summary = generate_summary(patient_id)
        context = f"Patient Medical Summary:\n\n{summary}\n\nMedical Records:\n\n"
        for record in records:
            context += (
                f"Date: {record.get('created_at')}\n"
                f"Doctor: {record.get('doctor')}\n"
                f"Hospital: {record.get('hospital')}\n"
                f"Diagnosis: {record.get('diagnosis')}\n"
                f"Medicines: {_format_medicines(record.get('medicines', []))}\n"
                "---\n\n"
            )
    else:
        context = "No medical records are on file for this patient yet."

    prompt = f"""You are Vitalis, a medical assistant for the Lifeline app.

You can answer two kinds of questions:

1. Questions about this specific patient's own health history — answer these ONLY \
using the Patient Information provided below. Never invent or assume facts not \
present there. If the information is not in their records, say exactly:
"I don't have enough information in your medical records for that."

2. General medical knowledge questions (e.g. definitions, how a condition or test \
works) — you may answer these using your general medical knowledge, even if \
unrelated to anything in the patient's records. Keep these answers general and \
educational, and do not claim the patient has or does not have the condition being \
asked about unless that is explicitly stated in their records below.

Always clearly distinguish which type of question you are answering. Never present \
general knowledge as if it were a fact about this patient's own health.

Patient Information:
{context}

Question:
{question}

Answer:"""

    return generate(prompt)
