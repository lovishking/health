from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class UserBase(BaseModel):
    email: str = Field(..., description="Clinician email address")
    display_name: Optional[str] = Field(None, description="Full name or clinician title (e.g. Dr. Lovish)")
    phone_number: Optional[str] = Field(None, description="Mobile number for SMS notification dispatch (e.g. +1234567890)")
    role: str = Field("user", description="Role: user or admin")


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Account password")


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SmtpSettingsUpdate(BaseModel):
    smtp_host: str = Field(..., description="SMTP server hostname")
    smtp_port: int = Field(587, ge=1, le=65535)
    smtp_username: Optional[str] = None
    smtp_password: str = Field(..., min_length=1)
    smtp_from_email: str
    smtp_from_name: Optional[str] = "RT-HDSS Clinical Alerts"
    smtp_use_tls: bool = True
    smtp_enabled: bool = True


class UserResponse(UserBase):
    id: str
    is_active: bool
    smtp_enabled: bool = False
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = None
    smtp_username: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None
    smtp_use_tls: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
