from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class RiskPredictionResponse(BaseModel):
    id: str
    patient_id: str
    reading_id: Optional[str] = None
    model_version: str
    stable_probability: Optional[float] = None
    warning_probability: Optional[float] = None
    critical_probability: Optional[float] = None
    model_tier: Optional[str] = None
    final_tier: str
    decision_source: str
    explanation: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
