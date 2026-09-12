"""EasyOCR fallback engine.

Lazy-initialised: the EasyOCR Reader is only constructed on the first call
to extract_text(), so normal startup is unaffected when EasyOCR is not needed.
The reader instance is cached at module level to avoid repeated model loads
within the same process.

Supports the same file types accepted by the upload endpoint:
  .pdf  — each page is rendered to a PIL image via pdf2image (optional dep);
           if pdf2image is not installed the PDF bytes are passed directly to
           EasyOCR, which handles single-page PDFs natively.
  .png / .jpg / .jpeg — passed directly as a file path.

Returns: (text: str, confidence: float)
  confidence is the mean of all per-word confidence scores (0.0 – 1.0).
  Returns (text, 0.0) when EasyOCR returns no detections.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from app.utils.logger import logger

if TYPE_CHECKING:  # pragma: no cover
    import easyocr as _easyocr_type

# Module-level cache — None until first use.
_reader: "_easyocr_type.Reader | None" = None


def _get_reader() -> "_easyocr_type.Reader":
    """Return the cached EasyOCR Reader, initialising it on first call."""
    global _reader
    if _reader is None:
        import easyocr  # deferred import — lazy init
        logger.info("EasyOCR: initialising Reader (first use)")
        _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        logger.info("EasyOCR: Reader ready")
    return _reader


def extract_text(file_path: str) -> tuple[str, float]:
    """Extract text from *file_path* using EasyOCR.

    Args:
        file_path: Absolute or relative path to a PDF, PNG, JPG, or JPEG file.

    Returns:
        (text, confidence) where confidence is in [0.0, 1.0].

    Raises:
        FileNotFoundError: if *file_path* does not exist.
        Any exception raised by EasyOCR or image loading is allowed to
        propagate so the caller can decide how to handle it.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    reader = _get_reader()
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        results = _read_pdf(reader, path)
    else:
        # PNG / JPG / JPEG — pass the path string directly.
        results = reader.readtext(str(path))

    if not results:
        return "", 0.0

    # results is a list of (bbox, text, confidence) tuples.
    lines = [item[1] for item in results]
    confidences = [float(item[2]) for item in results]

    text = "\n".join(lines)
    mean_confidence = sum(confidences) / len(confidences)

    return text, mean_confidence


def _read_pdf(reader: "_easyocr_type.Reader", path: Path) -> list:
    """Render each PDF page to an image and run EasyOCR on it.

    Falls back to passing the raw bytes directly to EasyOCR if pdf2image is
    not installed (EasyOCR can handle single-page PDFs natively).
    """
    try:
        from pdf2image import convert_from_path  # optional dependency
        import numpy as np

        pages = convert_from_path(str(path))
        all_results: list = []
        for page_img in pages:
            page_array = np.array(page_img)
            all_results.extend(reader.readtext(page_array))
        return all_results

    except ImportError:
        # pdf2image not available — pass raw bytes; works for single-page PDFs.
        logger.warning(
            "EasyOCR: pdf2image not installed — passing raw PDF bytes "
            "(multi-page PDFs may be read as a single page)"
        )
        return reader.readtext(path.read_bytes())
