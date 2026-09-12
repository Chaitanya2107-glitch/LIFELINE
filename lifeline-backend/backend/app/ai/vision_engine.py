import base64
import requests

from app.config.settings import settings


VISION_URL = (
    "https://vision.googleapis.com/v1/images:annotate"
)


def extract_text(file_path: str) -> str:
    """
    Extract text using Google Vision OCR API.
    """

    with open(file_path, "rb") as image_file:
        image_bytes = image_file.read()

    encoded_image = base64.b64encode(
        image_bytes
    ).decode("utf-8")


    payload = {
        "requests": [
            {
                "image": {
                    "content": encoded_image
                },
                "features": [
                    {
                        "type": "TEXT_DETECTION"
                    }
                ]
            }
        ]
    }


    response = requests.post(
        f"{VISION_URL}?key={settings.GOOGLE_VISION_API_KEY}",
        json=payload
    )


    response.raise_for_status()

    result = response.json()


    annotations = (
        result
        .get("responses", [{}])[0]
        .get("textAnnotations", [])
    )


    if not annotations:
        return ""


    return annotations[0]["description"]
