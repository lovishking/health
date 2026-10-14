from datetime import datetime
from typing import Dict, Any
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    database: str
    redis_enabled: bool
    timestamp: datetime
