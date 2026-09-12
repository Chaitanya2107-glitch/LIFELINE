from app.ai.providers.groq_provider import generate
from app.ai.prompts import MEDICAL_EXTRACTION_PROMPT


def extract_medical_data(text: str) -> str:
    prompt = f"""
{MEDICAL_EXTRACTION_PROMPT}

Medical Report:

{text}
"""

    return generate(prompt)
