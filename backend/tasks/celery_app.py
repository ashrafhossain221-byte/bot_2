from celery import Celery
from celery.schedules import crontab
from config.settings import get_settings

settings = get_settings()

celery_app = Celery(
    "botcore",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["tasks.automation_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Retry failed tasks once after 60s
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        # Send any messages whose scheduled_at has passed — runs every minute
        "send-due-messages": {
            "task": "tasks.automation_tasks.send_due_messages",
            "schedule": 60.0,  # seconds
        },
        # Find leads with no reply for 24h and trigger follow-up — every 30 min
        "check-no-reply-leads": {
            "task": "tasks.automation_tasks.check_no_reply_leads",
            "schedule": 1800.0,  # seconds
        },
    },
)
