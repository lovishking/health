import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VitalReading(Base):
    __tablename__ = "vital_readings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    patient_id = Column(String(64), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String(64), default="unknown", nullable=False)
    source_event_id = Column(String(128), nullable=True, index=True)
    event_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    ingested_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Core physiological vitals
    heart_rate = Column(Float, nullable=True)
    spo2 = Column(Float, nullable=True)
    systolic_bp = Column(Float, nullable=True)
    diastolic_bp = Column(Float, nullable=True)
    respiratory_rate = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)

    # Data quality flags & missingness notes
    quality_flags = Column(Text, nullable=True)

    # Relationships
    patient = relationship("Patient", back_populates="readings")
    prediction = relationship("RiskPrediction", back_populates="reading", uselist=False)

    __table_args__ = (
        UniqueConstraint("patient_id", "source", "source_event_id", name="uq_patient_source_event"),
        Index("ix_vital_readings_patient_timestamp", "patient_id", "event_timestamp"),
    )
