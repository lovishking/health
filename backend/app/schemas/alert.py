from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class AlertAcknowledgeRequest(BaseModel):
    acknowledged_by: str = Field("clinician_user", description="Identifier of the acknowledging clinician")


class AlertResponse(BaseModel):
    id: str
    patient_id: str
    prediction_id: Optional[str] = None
    severity: str
    message: str
    status: str
    created_at: datetime
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
