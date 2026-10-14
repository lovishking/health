from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict


class VitalReadingBase(BaseModel):
    source: str = Field("unknown", description="Data source: physionet_replay, synthetic, wearable_ble, manual")
    source_event_id: Optional[str] = Field(None, description="Idempotency key / event identifier from source")
    event_timestamp: datetime = Field(..., description="Timestamp when measurement was physically observed")

    heart_rate: Optional[float] = Field(None, description="Heart rate in beats per minute (bpm)")
    spo2: Optional[float] = Field(None, description="Blood oxygen saturation in % (0-100)")
    systolic_bp: Optional[float] = Field(None, description="Systolic blood pressure in mmHg")
    diastolic_bp: Optional[float] = Field(None, description="Diastolic blood pressure in mmHg")
    respiratory_rate: Optional[float] = Field(None, description="Respiratory rate in breaths per minute")
    temperature: Optional[float] = Field(None, description="Body temperature in Celsius")


class VitalReadingCreate(VitalReadingBase):
    patient_id: Optional[str] = Field(None, description="Target patient ID or display_id if provided in body")


class BatchReadingCreate(BaseModel):
    readings: List[VitalReadingCreate]


class VitalReadingResponse(VitalReadingBase):
    id: str
    patient_id: str
    ingested_at: datetime
    quality_flags: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
