import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.base import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    alert_id = Column(String(36), ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String(32), default="websocket", nullable=False)  # "websocket", "sms", "mock"
    provider_message_id = Column(String(128), nullable=True)
    delivery_status = Column(String(32), default="pending", nullable=False)  # "delivered", "failed", "mocked"
    attempt_count = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    alert = relationship("Alert", back_populates="notification_logs")
