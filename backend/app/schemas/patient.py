from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class PatientBase(BaseModel):
    display_id: str = Field(..., description="Unique alphanumeric identifier (e.g. DEMO-001)")
    display_name: Optional[str] = Field(None, description="Display name for clinical review")
    status: str = Field("active", description="Status: active, discharged, critical")


class PatientCreate(PatientBase):
    id: Optional[str] = None


class PatientResponse(PatientBase):
    id: str
    created_at: datetime
    latest_reading_time: Optional[datetime] = None
    latest_tier: Optional[str] = None
    active_alerts_count: int = 0

    model_config = ConfigDict(from_attributes=True)
