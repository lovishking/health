import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Index
from app.db.base import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    actor_id = Column(String(128), default="system", nullable=False)
    action = Column(String(128), nullable=False)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(128), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    metadata_json = Column(Text, nullable=True)

    __table_args__ = (
        Index("ix_audit_logs_resource", "resource_type", "resource_id"),
    )
