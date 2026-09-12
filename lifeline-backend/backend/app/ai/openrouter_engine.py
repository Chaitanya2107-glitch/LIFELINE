from openai import OpenAI

from app.config.settings import settings

client = OpenAI(
    api_key=settings.OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
)


def generate(prompt: str) -> str:
    response = client.chat.completions.create(
        model="google/gemma-4-31b-it:free",
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
    )

    return response.choices[0].message.content
