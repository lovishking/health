from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class UserBase(BaseModel):
    email: str = Field(..., description="Clinician email address")
    display_name: Optional[str] = Field(None, description="Full name or clinician title (e.g. Dr. Lovish)")
    phone_number: Optional[str] = Field(None, description="Mobile number for SMS notification dispatch (e.g. +1234567890)")
    role: str = Field("clinician", description="Role: intensivist, nurse, clinician, admin")


class UserCreate(UserBase):
    password: Optional[str] = Field("HospitalSecure2026!", description="Account password")


class UserResponse(UserBase):
    id: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
