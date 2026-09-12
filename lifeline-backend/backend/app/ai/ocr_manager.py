import time

from app.ai.tesseract_engine import extract_text as tesseract_extract
from app.utils.logger import logger

# Minimum character count from primary OCR before the result is considered
# "insufficient" and the EasyOCR fallback is attempted.
_MIN_TEXT_LENGTH = 20


def extract_text(file_path: str) -> str:
    """Extract text using the best available OCR engine.

    Primary path: Tesseract.
    Fallback to EasyOCR when the primary:
      - raises any exception, OR
      - returns text shorter than _MIN_TEXT_LENGTH characters (empty / insufficient).

    The confidence threshold branch (< 0.7) also triggers the fallback so that
    low-quality Tesseract results get a second chance through EasyOCR.

    If both engines fail, the exception from EasyOCR is re-raised so the
    upload endpoint can return the appropriate HTTP 400 error.
    """
    start_time = time.time()
    primary_failed = False
    primary_text: str | None = None

    # ── Primary: Tesseract ───────────────────────────────────────────────────
    logger.info(
        "OCR started | engine=tesseract | file={}",
        file_path,
    )

    try:
        text, confidence = tesseract_extract(file_path)
        duration = round(time.time() - start_time, 2)

        logger.info(
            "OCR completed | engine=tesseract | confidence={:.2f} | duration={}s",
            confidence,
            duration,
        )

        if len(text.strip()) >= _MIN_TEXT_LENGTH and confidence >= 0.7:
            return text

        # Keep the result in case EasyOCR also fails — Tesseract output is
        # still better than nothing only when it has some content.
        if text.strip():
            primary_text = text

        if len(text.strip()) < _MIN_TEXT_LENGTH:
            logger.warning(
                "OCR primary returned insufficient text (len={}) — trying EasyOCR fallback",
                len(text.strip()),
            )
        else:
            logger.warning(
                "OCR primary confidence below threshold ({:.2f}) — trying EasyOCR fallback",
                confidence,
            )

    except Exception as exc:
        duration = round(time.time() - start_time, 2)
        logger.warning(
            "OCR primary failed | engine=tesseract | duration={}s | error={} — trying EasyOCR fallback",
            duration,
            str(exc),
        )
        primary_failed = True

    # ── Fallback: EasyOCR ────────────────────────────────────────────────────
    try:
        from app.ai.easyocr_engine import extract_text as easyocr_extract  # lazy import

        fallback_start = time.time()
        logger.info("OCR fallback started | engine=easyocr | file={}", file_path)

        fb_text, fb_confidence = easyocr_extract(file_path)
        fb_duration = round(time.time() - fallback_start, 2)

        logger.info(
            "OCR fallback completed | engine=easyocr | confidence={:.2f} | duration={}s",
            fb_confidence,
            fb_duration,
        )

        if fb_text.strip():
            return fb_text

        # EasyOCR returned empty text — fall through to error handling.
        logger.warning("OCR fallback returned empty text | engine=easyocr")

    except Exception as fb_exc:
        logger.error(
            "OCR fallback failed | engine=easyocr | error={}",
            str(fb_exc),
        )
        # If primary had some text (low-confidence), return it rather than
        # failing completely — a degraded result is better than a hard error
        # when the cause is a confidence/length threshold, not a real failure.
        if not primary_failed and primary_text:
            logger.warning(
                "Both OCR engines degraded — returning low-confidence Tesseract text"
            )
            return primary_text
        raise

    # Both engines ran but both returned empty text.
    # Raise so the upload endpoint surfaces the existing HTTP 400 path.
    raise RuntimeError(
        "OCR extracted no readable text from the file using either engine."
    )
