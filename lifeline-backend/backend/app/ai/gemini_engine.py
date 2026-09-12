from google import genai

from app.config.settings import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate(prompt: str) -> str:
    """
    Send a prompt to Gemini and return plain text.
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return response.text
