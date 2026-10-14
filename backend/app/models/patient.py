import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    display_id = Column(String(64), unique=True, index=True, nullable=False)
    display_name = Column(String(128), nullable=True)
    status = Column(String(32), default="active", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    readings = relationship("VitalReading", back_populates="patient", cascade="all, delete-orphan", order_by="desc(VitalReading.event_timestamp)")
    predictions = relationship("RiskPrediction", back_populates="patient", cascade="all, delete-orphan", order_by="desc(RiskPrediction.created_at)")
    alerts = relationship("Alert", back_populates="patient", cascade="all, delete-orphan", order_by="desc(Alert.created_at)")
