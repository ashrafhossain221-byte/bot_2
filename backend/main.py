from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import os

from config.settings import get_settings
from core.database import create_tables
from api.routes import (
    health, chat, telegram, settings as settings_routes, leads, dashboard,
    conversations, multimodal, automations,
    whatsapp, facebook, instagram,
    products, orders, broadcasts, tenants,
    knowledge, analytics, comments,
)

logging.basicConfig(level=get_settings().LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting BotCore AI...")
    create_tables()
    logger.info("Database tables ready")
    # Seed default automation flows (no-op if they already exist)
    from core.database import SessionLocal
    from services.automation_service import seed_default_flows
    with SessionLocal() as db:
        seed_default_flows(db)
    logger.info("Automation flows ready")
    yield
    logger.info("BotCore AI shutting down")


app = FastAPI(
    title="BotCore AI",
    description="AI-powered chatbot backend for social channels",
    version="1.0.0",
    lifespan=lifespan,
)

_settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(telegram.router, prefix="/api/telegram", tags=["telegram"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])
app.include_router(leads.router, prefix="/api/leads", tags=["leads"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(multimodal.router, prefix="/api/multimodal", tags=["multimodal"])
app.include_router(automations.router, prefix="/api/automations", tags=["automations"])

# Phase 6 — Multichannel & Commerce
app.include_router(whatsapp.router, prefix="/api/whatsapp", tags=["whatsapp"])
app.include_router(facebook.router, prefix="/api/facebook", tags=["facebook"])
app.include_router(instagram.router, prefix="/api/instagram", tags=["instagram"])
app.include_router(products.router, prefix="/api/products", tags=["products"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(broadcasts.router, prefix="/api/broadcasts", tags=["broadcasts"])
app.include_router(tenants.router, prefix="/api/tenants", tags=["tenants"])

# Phase 7 — RAG, Analytics, Comments
app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])


@app.get("/")
def root():
    return {"status": "BotCore AI is running", "version": "1.0.0"}


# Serve the embeddable chat widget JS
_widget_dir = os.path.join(os.path.dirname(__file__), "widget")
if os.path.isdir(_widget_dir):
    app.mount("/widget", StaticFiles(directory=_widget_dir), name="widget")
