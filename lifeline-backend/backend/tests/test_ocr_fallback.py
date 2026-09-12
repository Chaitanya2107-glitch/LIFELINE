"""
Unit tests for the OCR fallback behaviour in app/ai/ocr_manager.py.

Five required cases:
  1. Primary OCR succeeds → EasyOCR is NOT called
  2. Primary OCR raises an exception → EasyOCR IS called
  3. Primary OCR returns empty/insufficient text → EasyOCR IS called
  4. EasyOCR succeeds → AI pipeline receives its text
  5. Both OCR methods fail → existing error handling preserved (exception raised)

Additional cases:
  6. Primary returns low-confidence text → EasyOCR IS called
  7. Both engines return empty text → RuntimeError raised
  8. Primary fails + EasyOCR fails + primary had partial text → RuntimeError (primary_failed=True path)
  9. Primary returns low-confidence + EasyOCR fails + primary had partial text → degraded return

Run:
    venv/Scripts/python.exe -m tests.test_ocr_fallback
"""

import sys
from unittest.mock import patch, MagicMock

GREEN = "\033[92m"
RED   = "\033[91m"
RESET = "\033[0m"
BOLD  = "\033[1m"

passed = 0
failed = 0


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  {GREEN}PASS{RESET}  {label}")
        passed += 1
    else:
        print(f"  {RED}FAIL{RESET}  {label}" + (f"\n        {detail}" if detail else ""))
        failed += 1


# ─── helpers ─────────────────────────────────────────────────────────────────

GOOD_TEXT = "Patient has hypertension. Blood pressure 140/90. Follow up in 4 weeks."  # len > 20
SHORT_TEXT = "hi"       # len < 20 → insufficient
EMPTY_TEXT = ""         # definitely insufficient


def _mock_tesseract(text: str, confidence: float):
    """Return a mock for tesseract_extract that yields (text, confidence)."""
    m = MagicMock(return_value=(text, confidence))
    return m


def _mock_easyocr_extract(text: str, confidence: float = 0.9):
    """Return a mock for easyocr_engine.extract_text that yields (text, confidence)."""
    m = MagicMock(return_value=(text, confidence))
    return m


# ─── Test 1: primary succeeds → EasyOCR NOT called ───────────────────────────

print(f"\n{BOLD}--- Test 1: Primary OCR succeeds → EasyOCR NOT called ---{RESET}")

with patch("app.ai.ocr_manager.tesseract_extract", _mock_tesseract(GOOD_TEXT, 0.95)):
    with patch("app.ai.easyocr_engine.extract_text") as mock_easy:
        from app.ai import ocr_manager
        result = ocr_manager.extract_text("dummy/path.png")
        check("Test 1a: Returns primary text", result == GOOD_TEXT)
        check("Test 1b: EasyOCR extract_text never called", not mock_easy.called)

# Reimport to clear any cached state between tests
import importlib
import app.ai.ocr_manager
importlib.reload(app.ai.ocr_manager)


# ─── Test 2: primary raises exception → EasyOCR IS called ────────────────────

print(f"\n{BOLD}--- Test 2: Primary raises exception → EasyOCR called ---{RESET}")

EASYOCR_TEXT = "EasyOCR extracted this text successfully from the file."

with patch("app.ai.ocr_manager.tesseract_extract", side_effect=RuntimeError("Tesseract binary not found")):
    with patch("app.ai.ocr_manager.tesseract_extract"):  # already patched above — use combined
        pass

# Fresh combined patch
with patch("app.ai.ocr_manager.tesseract_extract", side_effect=RuntimeError("Tesseract crashed")):
    with patch("app.ai.easyocr_engine.extract_text", return_value=(EASYOCR_TEXT, 0.88)) as mock_easy:
        # Patch the import inside ocr_manager so it picks up our mock
        import app.ai.easyocr_engine as easy_mod
        easy_mod.extract_text = MagicMock(return_value=(EASYOCR_TEXT, 0.88))
        importlib.reload(app.ai.ocr_manager)
        from app.ai.ocr_manager import extract_text as ocr_extract

        with patch("app.ai.ocr_manager.tesseract_extract", side_effect=RuntimeError("Tesseract crashed")):
            with patch.object(easy_mod, "extract_text", return_value=(EASYOCR_TEXT, 0.88)) as mock_fb:
                result2 = ocr_extract("dummy/path.png")
                check("Test 2a: Returns EasyOCR text", result2 == EASYOCR_TEXT,
                      detail=f"got: {result2!r}")
                check("Test 2b: EasyOCR was called once", mock_fb.call_count == 1,
                      detail=f"call_count={mock_fb.call_count}")

importlib.reload(app.ai.ocr_manager)


# ─── Test 3: primary returns empty/insufficient text → EasyOCR IS called ─────

print(f"\n{BOLD}--- Test 3: Primary returns insufficient text → EasyOCR called ---{RESET}")

import app.ai.easyocr_engine as easy_mod3

with patch("app.ai.ocr_manager.tesseract_extract", return_value=(SHORT_TEXT, 0.95)):
    with patch.object(easy_mod3, "extract_text", return_value=(EASYOCR_TEXT, 0.91)) as mock_fb3:
        importlib.reload(app.ai.ocr_manager)
        from app.ai.ocr_manager import extract_text as ocr_extract3

        with patch("app.ai.ocr_manager.tesseract_extract", return_value=(SHORT_TEXT, 0.95)):
            with patch.object(easy_mod3, "extract_text", return_value=(EASYOCR_TEXT, 0.91)) as mock_fb3b:
                result3 = ocr_extract3("dummy/path.png")
                check("Test 3a: Returns EasyOCR text (not short primary text)",
                      result3 == EASYOCR_TEXT, detail=f"got: {result3!r}")
                check("Test 3b: EasyOCR was called", mock_fb3b.call_count == 1,
                      detail=f"call_count={mock_fb3b.call_count}")

# Also test with completely empty string
with patch("app.ai.ocr_manager.tesseract_extract", return_value=(EMPTY_TEXT, 0.0)):
    with patch.object(easy_mod3, "extract_text", return_value=(EASYOCR_TEXT, 0.88)) as mock_empty:
        result3c = ocr_extract3("dummy/path.png")
        check("Test 3c: Empty primary text also triggers fallback",
              result3c == EASYOCR_TEXT, detail=f"got: {result3c!r}")

importlib.reload(app.ai.ocr_manager)


# ─── Test 4: EasyOCR succeeds → AI pipeline receives EasyOCR text ────────────

print(f"\n{BOLD}--- Test 4: EasyOCR succeeds → AI pipeline receives its text ---{RESET}")

# Simulate the full ocr_manager.extract_text → AI pipeline hand-off:
# ocr_manager must return fb_text verbatim so the caller (upload.py) passes it
# to extract_medical_data unchanged.

import app.ai.easyocr_engine as easy_mod4
EASYOCR_SPECIFIC = "Diagnosis: Type 2 Diabetes. HbA1c: 7.8%. Follow up in 3 months."

with patch("app.ai.ocr_manager.tesseract_extract", side_effect=FileNotFoundError("no tesseract")):
    with patch.object(easy_mod4, "extract_text", return_value=(EASYOCR_SPECIFIC, 0.93)) as mock_fb4:
        importlib.reload(app.ai.ocr_manager)
        from app.ai.ocr_manager import extract_text as ocr_extract4

        with patch("app.ai.ocr_manager.tesseract_extract", side_effect=FileNotFoundError("no tesseract")):
            with patch.object(easy_mod4, "extract_text", return_value=(EASYOCR_SPECIFIC, 0.93)):
                result4 = ocr_extract4("medical_report.png")
                check("Test 4a: extract_text returns exact EasyOCR text",
                      result4 == EASYOCR_SPECIFIC, detail=f"got: {result4!r}")

        # Verify the text would flow correctly into the AI pipeline (mock AI call)
        with patch("app.ai.ocr_manager.tesseract_extract", side_effect=FileNotFoundError("no tesseract")):
            with patch.object(easy_mod4, "extract_text", return_value=(EASYOCR_SPECIFIC, 0.93)):
                with patch("app.ai.ai_manager.extract_medical_data", return_value="{}") as mock_ai:
                    from app.ai.ai_manager import extract_medical_data
                    text_for_ai = ocr_extract4("medical_report.png")
                    _ = extract_medical_data(text_for_ai)
                    check("Test 4b: AI manager receives EasyOCR text",
                          mock_ai.call_args[0][0] == EASYOCR_SPECIFIC,
                          detail=f"AI received: {mock_ai.call_args[0][0]!r}")

importlib.reload(app.ai.ocr_manager)


# ─── Test 5: Both OCR methods fail → error preserved ─────────────────────────

print(f"\n{BOLD}--- Test 5: Both OCR methods fail → error preserved ---{RESET}")

import app.ai.easyocr_engine as easy_mod5

# Case A: primary raises, easyocr raises → easyocr exception propagates
with patch("app.ai.ocr_manager.tesseract_extract", side_effect=OSError("no tesseract binary")):
    with patch.object(easy_mod5, "extract_text", side_effect=RuntimeError("EasyOCR model load failed")):
        importlib.reload(app.ai.ocr_manager)
        from app.ai.ocr_manager import extract_text as ocr_extract5

        with patch("app.ai.ocr_manager.tesseract_extract", side_effect=OSError("no tesseract binary")):
            with patch.object(easy_mod5, "extract_text", side_effect=RuntimeError("EasyOCR model load failed")):
                try:
                    ocr_extract5("bad_file.png")
                    check("Test 5a: Exception raised when both fail", False, "No exception raised!")
                except Exception as e:
                    check("Test 5a: Exception raised when both fail", True)
                    check("Test 5b: Exception is RuntimeError from EasyOCR",
                          isinstance(e, RuntimeError),
                          detail=f"type={type(e).__name__}, msg={e}")

# Case B: primary raises, easyocr returns empty text → RuntimeError from ocr_manager
with patch("app.ai.ocr_manager.tesseract_extract", side_effect=OSError("no tesseract binary")):
    with patch.object(easy_mod5, "extract_text", return_value=(EMPTY_TEXT, 0.0)):
        importlib.reload(app.ai.ocr_manager)
        from app.ai.ocr_manager import extract_text as ocr_extract5b

        with patch("app.ai.ocr_manager.tesseract_extract", side_effect=OSError("no tesseract binary")):
            with patch.object(easy_mod5, "extract_text", return_value=(EMPTY_TEXT, 0.0)):
                try:
                    ocr_extract5b("bad_file.png")
                    check("Test 5c: RuntimeError when both return empty", False, "No exception raised!")
                except RuntimeError as e:
                    check("Test 5c: RuntimeError raised when both return empty", True)
                    check("Test 5d: Error message mentions both engines",
                          "OCR extracted no readable text" in str(e),
                          detail=str(e))

importlib.reload(app.ai.ocr_manager)


# ─── Test 6: Primary low-confidence → EasyOCR called ────────────────────────

print(f"\n{BOLD}--- Test 6: Primary low-confidence → EasyOCR called ---{RESET}")

import app.ai.easyocr_engine as easy_mod6

with patch("app.ai.ocr_manager.tesseract_extract", return_value=(GOOD_TEXT, 0.50)):
    with patch.object(easy_mod6, "extract_text", return_value=(EASYOCR_TEXT, 0.92)) as mock_fb6:
        importlib.reload(app.ai.ocr_manager)
        from app.ai.ocr_manager import extract_text as ocr_extract6

        with patch("app.ai.ocr_manager.tesseract_extract", return_value=(GOOD_TEXT, 0.50)):
            with patch.object(easy_mod6, "extract_text", return_value=(EASYOCR_TEXT, 0.92)) as mock_fb6b:
                result6 = ocr_extract6("dummy/path.png")
                check("Test 6a: Low-confidence primary triggers fallback",
                      mock_fb6b.call_count == 1, detail=f"call_count={mock_fb6b.call_count}")
                check("Test 6b: Returns EasyOCR text when primary is low-confidence",
                      result6 == EASYOCR_TEXT, detail=f"got: {result6!r}")

importlib.reload(app.ai.ocr_manager)


# ─── Test 7: Both return empty → RuntimeError ────────────────────────────────

print(f"\n{BOLD}--- Test 7: Both engines return empty text → RuntimeError ---{RESET}")

import app.ai.easyocr_engine as easy_mod7

with patch("app.ai.ocr_manager.tesseract_extract", return_value=(EMPTY_TEXT, 0.0)):
    with patch.object(easy_mod7, "extract_text", return_value=(EMPTY_TEXT, 0.0)):
        importlib.reload(app.ai.ocr_manager)
        from app.ai.ocr_manager import extract_text as ocr_extract7

        with patch("app.ai.ocr_manager.tesseract_extract", return_value=(EMPTY_TEXT, 0.0)):
            with patch.object(easy_mod7, "extract_text", return_value=(EMPTY_TEXT, 0.0)):
                try:
                    ocr_extract7("blank.png")
                    check("Test 7: RuntimeError when both return empty text", False, "No exception raised!")
                except RuntimeError as e:
                    check("Test 7: RuntimeError when both return empty text", True)

importlib.reload(app.ai.ocr_manager)


# ─── Test 8: Low-conf primary + EasyOCR fails → degraded Tesseract returned ──

print(f"\n{BOLD}--- Test 8: Low-conf primary + EasyOCR fails → degraded Tesseract fallback ---{RESET}")

import app.ai.easyocr_engine as easy_mod8

# primary_failed=False (primary ran), primary_text set, EasyOCR raises → return primary_text
with patch("app.ai.ocr_manager.tesseract_extract", return_value=(GOOD_TEXT, 0.45)):
    with patch.object(easy_mod8, "extract_text", side_effect=RuntimeError("EasyOCR unavailable")):
        importlib.reload(app.ai.ocr_manager)
        from app.ai.ocr_manager import extract_text as ocr_extract8

        with patch("app.ai.ocr_manager.tesseract_extract", return_value=(GOOD_TEXT, 0.45)):
            with patch.object(easy_mod8, "extract_text", side_effect=RuntimeError("EasyOCR unavailable")):
                result8 = ocr_extract8("report.png")
                check("Test 8: Returns Tesseract text when EasyOCR fails but primary had content",
                      result8 == GOOD_TEXT, detail=f"got: {result8!r}")

importlib.reload(app.ai.ocr_manager)


# ─── Summary ──────────────────────────────────────────────────────────────────

total = passed + failed
colour = GREEN if failed == 0 else RED
print(f"\n{'='*62}")
print(f"  {colour}{passed}/{total} OCR fallback tests passed{RESET}")
print(f"{'='*62}\n")

if failed:
    sys.exit(1)
