import httpx
import logging
from sqlalchemy.orm import Session
from models.bot_settings import BotSettings
from models.lead import Persona
from services.settings_service import get_settings, get_decrypted_api_key

logger = logging.getLogger(__name__)

# Groq default — free, fast, and OpenAI-compatible
DEFAULT_ENDPOINT = "https://api.groq.com/openai/v1"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


def _build_system_prompt(settings: BotSettings) -> str:
    parts = []

    name = settings.bot_name or "BotCore"
    tone = settings.tone or "friendly"
    gender = settings.gender or "neutral"
    length = settings.reply_length or "medium"

    gender_pronoun = {"male": "He/him", "female": "She/her"}.get(gender, "They/them")

    parts.append(
        f"You are {name}, an AI assistant. "
        f"Pronouns: {gender_pronoun}. "
        f"Tone: {tone}. "
        f"Keep replies {length} length."
    )

    if settings.reply_language and settings.reply_language != "auto":
        parts.append(f"Always reply in: {settings.reply_language}.")
    else:
        parts.append("Detect the user's language and reply in the same language.")

    if settings.business_name:
        parts.append(f"You work for {settings.business_name}.")
    if settings.business_type:
        parts.append(f"Business type: {settings.business_type}.")
    if settings.custom_instructions:
        parts.append(settings.custom_instructions)

    return " ".join(parts)


# Persona-specific prompt additions injected after the base system prompt
_PERSONA_PROMPTS: dict[str, str] = {
    Persona.price_sensitive: (
        "This customer is PRICE SENSITIVE. They care most about value for money. "
        "Proactively mention any discounts, offers, or payment options available. "
        "Emphasize cost-effectiveness and what they get for the price. "
        "If you don't know exact pricing, invite them to ask."
    ),
    Persona.trust_seeker: (
        "This customer is a TRUST SEEKER. They need reassurance before buying. "
        "Emphasize quality, authenticity, guarantees, return policy, and positive reviews. "
        "Be transparent, honest, and avoid overselling. Build confidence."
    ),
    Persona.fast_buyer: (
        "This customer is URGENCY-DRIVEN — they want things NOW. "
        "Be concise and action-oriented. Mention fastest available delivery options. "
        "Skip lengthy explanations. Guide them to place the order immediately."
    ),
    Persona.ready_to_buy: (
        "This customer is READY TO BUY. They have high purchase intent. "
        "Help them complete the purchase RIGHT NOW. Ask for their preferred product, "
        "quantity, and delivery address. Make the ordering process as smooth as possible."
    ),
    Persona.general: "",
}


def get_ai_reply(
    db: Session,
    history: list[dict],
    user_message: str,
    extra_context: str | None = None,
    persona: Persona | None = None,
    product_context: str | None = None,
    language_instruction: str | None = None,
    rag_context: str | None = None,
) -> str:
    settings = get_settings(db)
    api_key = get_decrypted_api_key(db)

    if not api_key:
        return (
            "I'm not configured yet. Please add an API key in the admin settings panel."
        )

    endpoint = (settings.api_endpoint or DEFAULT_ENDPOINT).rstrip("/")
    model = settings.model_name or DEFAULT_MODEL
    system_prompt = _build_system_prompt(settings)

    # Inject persona-aware coaching
    if persona and persona != Persona.general:
        persona_hint = _PERSONA_PROMPTS.get(persona, "")
        if persona_hint:
            system_prompt += f"\n\nBEHAVIOR COACHING:\n{persona_hint}"

    # Inject RAG knowledge base context (highest priority — business facts)
    if rag_context:
        system_prompt += f"\n\n{rag_context}"

    # Inject product catalog so bot can answer pricing/stock questions
    if product_context:
        system_prompt += f"\n\n{product_context}\nUse this catalog to answer product questions accurately."

    # Override language if detected/set
    if language_instruction:
        system_prompt += f"\n\nLANGUAGE RULE: {language_instruction}"

    if extra_context:
        system_prompt += f"\n\nAdditional context:\n{extra_context}"

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 1024,
    }

    try:
        with httpx.Client(timeout=30) as client:
            response = client.post(
                f"{endpoint}/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except httpx.HTTPStatusError as e:
        logger.error("AI API error %s: %s", e.response.status_code, e.response.text)
        return "Sorry, I'm having trouble connecting to the AI service right now."
    except Exception as e:
        logger.error("AI service exception: %s", str(e))
        return "Sorry, something went wrong. Please try again."
