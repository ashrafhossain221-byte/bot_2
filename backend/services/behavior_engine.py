"""
Behavior Detection Engine — Phase 2
Scans messages for intent signals, detects persona, extracts contact info.
Supports English + Bengali (Romanized and Unicode).
"""
import re
from dataclasses import dataclass, field
from models.lead import Persona


# ─── Keyword Signal Maps ──────────────────────────────────────────────────────
# Each list contributes to a score bucket. Score is normalized 0-10.

PRICE_SIGNALS = [
    # English
    "price", "cost", "how much", "pricing", "rate", "fee", "charge",
    "cheap", "cheapest", "affordable", "budget", "expensive", "discount",
    "offer", "deal", "sale", "promo", "coupon", "voucher", "cashback",
    "free delivery", "free shipping", "installment", "emi", "pay later",
    # Bengali Romanized
    "daam", "dam", "koto", "koto taka", "koto takar", "daam koto",
    "sosta", "shosto", "offer ache", "discount ache", "ছাড়",
    # Bengali Unicode
    "দাম", "কত", "কত টাকা", "সস্তা", "ছাড়", "অফার", "ডিসকাউন্ট",
]

TRUST_SIGNALS = [
    # English
    "review", "reviews", "rating", "ratings", "feedback", "testimonial",
    "guarantee", "warranty", "authentic", "original", "genuine", "real",
    "trusted", "reliable", "safe", "legit", "legitimate", "verified",
    "refund", "return", "return policy", "exchange", "quality", "good quality",
    "bad review", "scam", "fake",
    # Bengali Romanized
    "asol", "original kina", "fake na to", "biswas", "review daw",
    "return korte parbo", "refund pabo", "guarantee ache",
    # Bengali Unicode
    "আসল", "বিশ্বাস", "রিভিউ", "গ্যারান্টি", "রিটার্ন", "রিফান্ড",
]

FAST_BUYER_SIGNALS = [
    # English
    "urgent", "asap", "immediately", "right now", "today", "tonight",
    "this moment", "hurry", "fast", "quick", "quickly", "instant",
    "delivery today", "same day", "express delivery", "now",
    # Bengali Romanized
    "ekhoni", "ajke", "aজke", "ekhan", "jaldi", "taratari",
    "ajke chai", "abhi", "shiggir", "age age",
    # Bengali Unicode
    "এখনি", "আজকে", "এখন", "তাড়াতাড়ি", "জলদি", "আজই",
]

READY_TO_BUY_SIGNALS = [
    # English
    "buy", "purchase", "order", "place order", "add to cart", "checkout",
    "i want to buy", "i want to order", "i'll take", "i'll buy",
    "how to order", "how do i order", "where to buy", "can i buy",
    "booking", "book now", "reserve",
    # Bengali Romanized
    "kinte chai", "nibo", "order korbo", "kinte pari", "diben",
    "order dibo", "booking dibo", "kivabe order korbo",
    "ekta den", "duto den", "amake diben",
    # Bengali Unicode
    "কিনতে চাই", "নেব", "অর্ডার করব", "কিনতে পারি", "দিন",
    "অর্ডার দিব", "বুকিং দিব",
]

# Payment method mentions = strong purchase intent
PAYMENT_SIGNALS = [
    "bkash", "nagad", "rocket", "upay", "bank transfer", "card payment",
    "cash on delivery", "cod", "online payment", "pay", "payment",
    "বিকাশ", "নগদ", "রকেট", "পেমেন্ট",
]

# Order management intent signals (Phase 6)
ORDER_SIGNALS = [
    # English
    "my order", "order status", "where is my order", "track my order",
    "order number", "i ordered", "delivered", "not delivered", "cancel order",
    "order cancelled", "return item", "exchange item",
    # Bengali Romanized
    "amar order", "order koi", "order gache", "deliver hoise", "deliver hoy nai",
    "order cancel", "return dibo",
    # Bengali Unicode
    "আমার অর্ডার", "ডেলিভারি", "ক্যান্সেল",
]

# Contact info patterns
_PHONE_RE = re.compile(
    r"""(?:(?:\+?88)?01[3-9]\d{8}       # BD mobile
        |(?:\+?1)?[ -]?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}  # US
        |\+?\d{7,15})""",
    re.VERBOSE,
)
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_NAME_RE = re.compile(
    r"""(?:(?:my name is|i am|i'm|ami|amar naam|আমার নাম|আমি)\s+)
        ([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})""",
    re.IGNORECASE | re.VERBOSE,
)


# ─── Weights ──────────────────────────────────────────────────────────────────

SIGNAL_WEIGHTS = {
    "price": 1.0,
    "trust": 1.0,
    "fast": 1.5,       # urgency is strong
    "ready": 2.0,      # purchase intent is strongest
    "payment": 2.5,    # payment mention = very high intent
}

MAX_SCORE = 10.0


@dataclass
class BehaviorResult:
    persona: Persona = Persona.general
    intent_score: float = 0.0
    extracted_name: str | None = None
    extracted_phone: str | None = None
    extracted_email: str | None = None
    triggered_signals: list[str] = field(default_factory=list)


def _count_hits(text_lower: str, signals: list[str]) -> int:
    count = 0
    for sig in signals:
        if sig.lower() in text_lower:
            count += 1
    return count


def analyze(message: str, history: list[dict] | None = None) -> BehaviorResult:
    """
    Analyze a user message (and optional recent history) for behavior signals.
    Returns a BehaviorResult with persona, intent_score, and extracted contact info.
    """
    # Build a combined text window: current message + last 3 user messages
    user_texts = [message]
    if history:
        for h in reversed(history[-6:]):
            if h.get("role") == "user":
                user_texts.append(h["content"])
                if len(user_texts) >= 4:
                    break
    combined = " ".join(user_texts).lower()

    # Count hits per bucket
    price_hits = _count_hits(combined, PRICE_SIGNALS)
    trust_hits = _count_hits(combined, TRUST_SIGNALS)
    fast_hits = _count_hits(combined, FAST_BUYER_SIGNALS)
    ready_hits = _count_hits(combined, READY_TO_BUY_SIGNALS)
    payment_hits = _count_hits(combined, PAYMENT_SIGNALS)

    triggered = []
    if price_hits:
        triggered.append(f"price×{price_hits}")
    if trust_hits:
        triggered.append(f"trust×{trust_hits}")
    if fast_hits:
        triggered.append(f"fast×{fast_hits}")
    if ready_hits:
        triggered.append(f"ready×{ready_hits}")
    if payment_hits:
        triggered.append(f"payment×{payment_hits}")

    # Raw score (uncapped)
    raw = (
        price_hits * SIGNAL_WEIGHTS["price"]
        + trust_hits * SIGNAL_WEIGHTS["trust"]
        + fast_hits * SIGNAL_WEIGHTS["fast"]
        + ready_hits * SIGNAL_WEIGHTS["ready"]
        + payment_hits * SIGNAL_WEIGHTS["payment"]
    )

    # Normalize to 0-10 using a soft cap: score = 10 * raw / (raw + 5)
    intent_score = round(min(MAX_SCORE, MAX_SCORE * raw / (raw + 5) if raw > 0 else 0), 2)

    # Determine dominant persona
    bucket_scores = {
        Persona.price_sensitive: price_hits * SIGNAL_WEIGHTS["price"],
        Persona.trust_seeker: trust_hits * SIGNAL_WEIGHTS["trust"],
        Persona.fast_buyer: fast_hits * SIGNAL_WEIGHTS["fast"],
        Persona.ready_to_buy: (ready_hits * SIGNAL_WEIGHTS["ready"] + payment_hits * SIGNAL_WEIGHTS["payment"]),
    }
    top_persona = max(bucket_scores, key=bucket_scores.get)
    persona = top_persona if bucket_scores[top_persona] > 0 else Persona.general

    # Extract contact info from current message only (not history)
    msg_text = message

    extracted_phone = None
    phone_match = _PHONE_RE.search(msg_text)
    if phone_match:
        extracted_phone = phone_match.group().strip()

    extracted_email = None
    email_match = _EMAIL_RE.search(msg_text)
    if email_match:
        extracted_email = email_match.group().strip()

    extracted_name = None
    name_match = _NAME_RE.search(msg_text)
    if name_match:
        extracted_name = name_match.group(1).strip().title()

    return BehaviorResult(
        persona=persona,
        intent_score=intent_score,
        extracted_name=extracted_name,
        extracted_phone=extracted_phone,
        extracted_email=extracted_email,
        triggered_signals=triggered,
    )
