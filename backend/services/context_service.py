"""
Shared context-building helper for all channel handlers (Phase 7).
Combines RAG retrieval + product catalog + language detection
into a single call, so every channel handler stays DRY.
"""
from sqlalchemy.orm import Session
from services.language_service import detect_language, resolve_reply_language, language_instruction
from services.product_service import search_products, format_catalog_context
from services.knowledge_service import search as kb_search, format_rag_context
from services.settings_service import get_settings


def build_reply_context(db: Session, user_text: str) -> dict:
    """
    Returns dict with keys:
      lang_hint, product_ctx, rag_ctx
    Pass these as kwargs to get_ai_reply().
    """
    bot_settings = get_settings(db)

    # Language
    detected_lang = detect_language(user_text)
    reply_lang = resolve_reply_language(bot_settings.reply_language or "auto", detected_lang)
    lang_hint = language_instruction(reply_lang) or None

    # RAG
    kb_chunks = kb_search(db, user_text, top_k=4)
    rag_ctx = format_rag_context(kb_chunks) if kb_chunks else None

    # Products
    matched_products = search_products(db, user_text, limit=4)
    product_ctx = format_catalog_context(matched_products) if matched_products else None

    return {
        "language_instruction": lang_hint,
        "rag_context": rag_ctx,
        "product_context": product_ctx,
    }
