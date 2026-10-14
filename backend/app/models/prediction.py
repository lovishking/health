import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from app.db.base import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(64), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    reading_id = Column(String(36), ForeignKey("vital_readings.id", ondelete="SET NULL"), nullable=True, index=True)

    model_version = Column(String(64), default="rules_v1.0", nullable=False)
    stable_probability = Column(Float, nullable=True)
    warning_probability = Column(Float, nullable=True)
    critical_probability = Column(Float, nullable=True)

    model_tier = Column(String(32), nullable=True)  # "Stable", "Warning", "Critical", or "Insufficient_Data"
    final_tier = Column(String(32), nullable=False)  # "Stable", "Warning", "Critical"
    decision_source = Column(String(64), nullable=False)  # "rules_provisional", "safety_override", "hybrid_fusion", etc.

    explanation = Column(Text, nullable=True)  # JSON formatted SHAP / rule explanation
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    # Relationships
    patient = relationship("Patient", back_populates="predictions")
    reading = relationship("VitalReading", back_populates="prediction")
    alerts = relationship("Alert", back_populates="prediction")

    __table_args__ = (
        Index("ix_risk_predictions_patient_created", "patient_id", "created_at"),
    )
