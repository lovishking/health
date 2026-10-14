import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.db.base import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(64), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_id = Column(String(36), ForeignKey("risk_predictions.id", ondelete="SET NULL"), nullable=True, index=True)

    severity = Column(String(32), nullable=False)  # "info", "warning", "critical"
    message = Column(String(512), nullable=False)
    status = Column(String(32), default="active", nullable=False)  # "active", "acknowledged", "resolved"

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    acknowledged_by = Column(String(128), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="alerts")
    prediction = relationship("RiskPrediction", back_populates="alerts")
    notification_logs = relationship("NotificationLog", back_populates="alert", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_alerts_patient_status_created", "patient_id", "status", "created_at"),
    )
