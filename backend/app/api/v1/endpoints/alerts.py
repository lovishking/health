from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.alert import AlertResponse, AlertAcknowledgeRequest
from app.services.patient_service import PatientService
from app.services.alert_service import AlertService

router = APIRouter()


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
