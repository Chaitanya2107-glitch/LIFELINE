import time

from groq import Groq

from app.config.settings import settings
from app.utils.logger import logger

client = Groq(api_key=settings.GROQ_API_KEY)


def generate(prompt: str) -> str:
    max_attempts = 3

    for attempt in range(1, max_attempts + 1):

        start_time = time.time()

        try:
            logger.info(
                "AI request started | Attempt: {} | Model: {}",
                attempt,
                settings.GROQ_MODEL,
            )

            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                temperature=0,
            )

            duration = round(time.time() - start_time, 2)

            logger.info(
                "AI request completed | Attempt: {} | Duration: {} seconds",
                attempt,
                duration,
            )

            return response.choices[0].message.content

        except Exception as e:

            duration = round(time.time() - start_time, 2)

            logger.error(
                "AI request failed | Attempt: {} | Duration: {} seconds | Error: {}",
                attempt,
                duration,
                str(e),
            )

            if attempt == max_attempts:
                raise

            logger.warning(
                "Retrying AI request... ({}/{})",
                attempt,
                max_attempts,
            )

            time.sleep(2)
