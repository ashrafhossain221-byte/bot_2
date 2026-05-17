"""
Voice Service — Phase 4
Transcribes audio to text.

Providers:
  groq    — Groq Whisper API (free tier, default). Uses the same API key as chat.
  openai  — OpenAI Whisper API (paid).
  local   — openai-whisper Python package (self-hosted, no API key needed).

Telegram sends voice as OGG/OPUS. Browsers send WebM or WAV.
All are accepted by the Groq/OpenAI endpoints directly.
"""
import io
import logging
import tempfile
import os
from pathlib import Path
from sqlalchemy.orm import Session

from config.settings import get_settings
from services.settings_service import get_decrypted_api_key

logger = logging.getLogger(__name__)


def transcribe(audio_bytes: bytes, filename: str, db: Session | None = None) -> str:
    """
    Transcribe audio bytes to text.
    Returns the transcript string, or an error message the bot can relay.
    """
    settings = get_settings()
    provider = settings.WHISPER_PROVIDER.lower()

    try:
        if provider == "local":
            return _transcribe_local(audio_bytes, filename, settings.WHISPER_MODEL)
        else:
            # Both "groq" and "openai" use the OpenAI-compatible endpoint
            api_key = get_decrypted_api_key(db) if db else ""
            if not api_key:
                return "[Voice message — AI not configured, cannot transcribe]"
            endpoint = (
                "https://api.groq.com/openai/v1"
                if provider == "groq"
                else "https://api.openai.com/v1"
            )
            return _transcribe_api(audio_bytes, filename, api_key, endpoint, settings.WHISPER_MODEL)
    except Exception as e:
        logger.error("Voice transcription error (%s): %s", provider, e)
        return "[Voice message — could not transcribe]"


def _transcribe_api(
    audio_bytes: bytes, filename: str, api_key: str, endpoint: str, model: str
) -> str:
    import httpx

    # Write to temp file so httpx can stream it with the correct filename
    suffix = Path(filename).suffix or ".ogg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            with httpx.Client(timeout=60) as client:
                resp = client.post(
                    f"{endpoint}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": (filename, f, _mime(filename))},
                    data={"model": model, "response_format": "text"},
                )
                resp.raise_for_status()
                return resp.text.strip()
    finally:
        os.unlink(tmp_path)


def _transcribe_local(audio_bytes: bytes, filename: str, model_name: str) -> str:
    try:
        import whisper  # type: ignore
    except ImportError:
        return "[Voice message — install 'openai-whisper' for local transcription]"

    suffix = Path(filename).suffix or ".ogg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        model = whisper.load_model(model_name or "base")
        result = model.transcribe(tmp_path)
        return result.get("text", "").strip()
    finally:
        os.unlink(tmp_path)


def _mime(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return {
        ".ogg": "audio/ogg",
        ".oga": "audio/ogg",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".webm": "audio/webm",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
    }.get(ext, "audio/octet-stream")
