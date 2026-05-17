"""
Language detection and reply-language resolution.
Uses lightweight heuristics (no external API required).
Falls back to langdetect if installed.
"""
import re

# Bengali Unicode range + common Romanized Bengali words
_BN_UNICODE = re.compile(r"[ঀ-৿]")
_BN_ROMANIZED = re.compile(
    r"\b(ami|apni|apu|bhai|vai|dada|didi|ki|ke|koto|daam|taka|tk|bkash|nagad|"
    r"kinte|kinbo|ache|nai|hobe|hbe|lagbe|dao|den|niben|bolun|janaben|"
    r"shukriya|dhonnobad|onek|ektu|jodi|tahole|seta|eta)\b",
    re.IGNORECASE,
)

# Arabic script
_AR_UNICODE = re.compile(r"[؀-ۿ]")

# Hindi/Devanagari
_HI_UNICODE = re.compile(r"[ऀ-ॿ]")


def detect_language(text: str) -> str:
    """
    Returns ISO 639-1 language code.
    Priority: Unicode script detection → romanized heuristics → langdetect → 'en'
    """
    if not text or len(text.strip()) < 3:
        return "en"

    if _BN_UNICODE.search(text):
        return "bn"
    if _AR_UNICODE.search(text):
        return "ar"
    if _HI_UNICODE.search(text):
        return "hi"

    # Romanized Bengali heuristic: 2+ matches = Bengali
    matches = _BN_ROMANIZED.findall(text)
    if len(matches) >= 2:
        return "bn"

    # Try langdetect if available
    try:
        from langdetect import detect  # type: ignore
        lang = detect(text)
        return lang if lang else "en"
    except Exception:
        pass

    return "en"


_LANG_NAMES = {
    "bn": "Bengali",
    "en": "English",
    "ar": "Arabic",
    "hi": "Hindi",
    "fr": "French",
    "es": "Spanish",
    "pt": "Portuguese",
    "id": "Indonesian",
    "tr": "Turkish",
    "ur": "Urdu",
}


def resolve_reply_language(setting: str, detected: str) -> str:
    """
    Returns the language the bot should reply in.
    setting: "auto" | ISO code from bot settings
    detected: ISO code from detect_language()
    """
    if setting == "auto":
        return detected
    return setting


def language_instruction(lang_code: str) -> str:
    """Return a system prompt instruction for the target language."""
    name = _LANG_NAMES.get(lang_code, lang_code)
    if lang_code == "bn":
        return (
            "Reply ONLY in Bengali. You may mix Romanized Bengali (Banglish) "
            "if the user used Banglish, otherwise use proper Bengali Unicode script."
        )
    if lang_code == "en":
        return ""
    return f"Reply ONLY in {name}."
