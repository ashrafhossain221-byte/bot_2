"""
Image Service — Phase 4
Extracts text from images via OCR.

Providers:
  tesseract — pytesseract + Tesseract-OCR (free, local, default).
              Install: pip install pytesseract Pillow
              System dep: https://github.com/tesseract-ocr/tesseract
  google    — Google Cloud Vision API (paid, high accuracy).
              Needs GOOGLE_VISION_API_KEY in settings.
"""
import io
import logging
from config.settings import get_settings

logger = logging.getLogger(__name__)

# Maximum characters of OCR text sent to the AI
MAX_OCR_CHARS = 2000


def extract_text(image_bytes: bytes) -> str:
    """
    Returns extracted text from the image.
    If OCR yields nothing, returns a descriptive fallback so the AI knows an image arrived.
    """
    settings = get_settings()
    provider = settings.IMAGE_PROVIDER.lower()

    try:
        if provider == "google":
            text = _google_vision(image_bytes, settings.GOOGLE_VISION_API_KEY)
        else:
            text = _tesseract(image_bytes)

        text = text.strip()
        if len(text) > MAX_OCR_CHARS:
            text = text[:MAX_OCR_CHARS] + "…"
        return text if text else "[Image received — no readable text detected]"
    except Exception as e:
        logger.error("Image OCR error (%s): %s", provider, e)
        return "[Image received — OCR processing failed]"


def _tesseract(image_bytes: bytes) -> str:
    try:
        from PIL import Image  # type: ignore
        import pytesseract     # type: ignore
    except ImportError:
        return "[Image received — install Pillow and pytesseract for OCR]"

    image = Image.open(io.BytesIO(image_bytes))
    # Try multiple OCR configs: first auto-detect language, fallback to English
    try:
        text = pytesseract.image_to_string(image, config="--oem 3 --psm 6")
    except Exception:
        text = pytesseract.image_to_string(image)
    return text


def _google_vision(image_bytes: bytes, api_key: str) -> str:
    if not api_key:
        return "[Google Vision API key not configured]"

    import base64
    import httpx

    payload = {
        "requests": [{
            "image": {"content": base64.b64encode(image_bytes).decode()},
            "features": [{"type": "TEXT_DETECTION"}, {"type": "DOCUMENT_TEXT_DETECTION"}],
        }]
    }
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            f"https://vision.googleapis.com/v1/images:annotate?key={api_key}",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    annotations = data.get("responses", [{}])[0].get("fullTextAnnotation", {})
    return annotations.get("text", "")
