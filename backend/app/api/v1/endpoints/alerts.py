from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.alert import AlertResponse, AlertAcknowledgeRequest
from app.services.patient_service import PatientService
from app.services.alert_service import AlertService
from app.services.notification_service import NotificationService
from app.core.config import settings

router = APIRouter()


class TestSmtpRequest(BaseModel):
    recipients: Optional[List[str]] = None


@router.get("/alerts/smtp-status", status_code=status.HTTP_200_OK)
def get_smtp_status(db: Session = Depends(get_db)):
    """Check SMTP notification system status, sender configuration, and active receiver list."""
    sender_cfg = NotificationService.get_smtp_sender_credentials()
    receivers = NotificationService.get_configured_receivers(db)
    return {
        "smtp_enabled": sender_cfg.get("is_enabled", False),
        "sender_email": sender_cfg.get("from_email"),
        "sender_name": sender_cfg.get("from_name"),
        "smtp_host": sender_cfg.get("host"),
        "smtp_port": sender_cfg.get("port"),
        "use_tls": sender_cfg.get("use_tls"),
        "receiver_count": len(receivers),
        "receivers": receivers,
    }


@router.post("/alerts/test-smtp", status_code=status.HTTP_200_OK)
def send_test_smtp_alert(req: Optional[TestSmtpRequest] = None, db: Session = Depends(get_db)):
    """Trigger a live test SMTP clinical alert email to configured receivers."""
    recipients = req.recipients if (req and req.recipients) else None
    results = NotificationService.send_test_notification(recipients_override=recipients)
    return {
        "status": "completed",
        "results": results
    }


@router.get("/alerts", response_model=List[AlertResponse])
def get_all_alerts(status_filter: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    """Fetch recent clinical alerts across patients."""
    query = db.query(Alert)
    if status_filter:
        query = query.filter(Alert.status == status_filter)
    return query.order_by(Alert.created_at.desc()).limit(limit).all()


@router.get("/patients/{patient_id}/alerts", response_model=List[AlertResponse])
def get_patient_alerts(patient_id: str, limit: int = 50, db: Session = Depends(get_db)):
    """Fetch active and acknowledged alerts for a patient."""
    patient = PatientService.get_by_id_or_display(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return AlertService.get_patient_alerts(db, patient_id=patient.id, limit=limit)


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: str,
    ack_data: AlertAcknowledgeRequest,
    db: Session = Depends(get_db)
):
    """Acknowledge a patient alert by clinician ID."""
    alert = AlertService.acknowledge_alert(
        db=db,
        alert_id=alert_id,
        acknowledged_by=ack_data.acknowledged_by
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
