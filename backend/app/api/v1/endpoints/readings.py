import asyncio
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.reading import VitalReadingCreate, BatchReadingCreate, VitalReadingResponse
from app.services.patient_service import PatientService
from app.services.reading_service import ReadingService
from app.services.assessment_service import AssessmentService
from app.services.alert_service import AlertService
from app.realtime.connection_manager import ws_manager

router = APIRouter()


@router.post("/patients/{patient_id}/readings", response_model=VitalReadingResponse, status_code=status.HTTP_201_CREATED)
async def ingest_patient_reading(
    patient_id: str,
    reading_in: VitalReadingCreate,
    db: Session = Depends(get_db)
):
    """
    Ingest a single physiological reading for a patient:
    1. Validates and auto-registers patient if not existing.
    2. Enforces idempotency via source_event_id.
    3. Performs physiological plausibility checks.
    4. Triggers risk assessment and clinical safety overrides.
    5. Dispatches alerts if risk tier is Warning/Critical.
    6. Broadcasts real-time events to connected clinicians over WebSocket.
    """
    patient = PatientService.get_or_create(db, display_id=patient_id)

    # Ingest reading
    reading, is_new = ReadingService.ingest_reading(db, patient_id=patient.id, reading_in=reading_in)

    if is_new:
        # Run assessment
        prediction = AssessmentService.evaluate_reading(db, reading=reading)

        # Evaluate alerts
        alert = AlertService.process_prediction_for_alerts(db, prediction=prediction)

        # Broadcast reading update
        reading_dict = {
            "id": reading.id,
            "patient_id": patient.display_id,
            "event_timestamp": reading.event_timestamp.isoformat(),
            "heart_rate": reading.heart_rate,
            "spo2": reading.spo2,
            "systolic_bp": reading.systolic_bp,
            "diastolic_bp": reading.diastolic_bp,
            "respiratory_rate": reading.respiratory_rate,
            "temperature": reading.temperature,
            "quality_flags": reading.quality_flags,
            "risk_tier": prediction.final_tier,
            "decision_source": prediction.decision_source,
            "alert_created": alert is not None
        }
        await ws_manager.broadcast_patient_event(patient.display_id, "reading_update", reading_dict)

        # Broadcast explicit alert_triggered event if alert was created
        if alert:
            alert_dict = {
                "id": alert.id,
                "patient_id": patient.display_id,
                "severity": alert.severity,
                "message": alert.message,
                "status": alert.status,
                "created_at": alert.created_at.isoformat()
            }
            await ws_manager.broadcast_patient_event(patient.display_id, "alert_triggered", alert_dict)

    return reading


@router.post("/readings/batch", status_code=status.HTTP_201_CREATED)
async def ingest_batch_readings(
    batch: BatchReadingCreate,
    db: Session = Depends(get_db)
):
    """Batch ingestion endpoint for replay streams and offline logs."""
    results = []
    for r in batch.readings:
        p_id = r.patient_id or "DEMO-001"
        patient = PatientService.get_or_create(db, display_id=p_id)
        reading, is_new = ReadingService.ingest_reading(db, patient_id=patient.id, reading_in=r)
        if is_new:
            prediction = AssessmentService.evaluate_reading(db, reading)
            alert = AlertService.process_prediction_for_alerts(db, prediction)

            # Broadcast reading update via WebSocket (same as single-reading endpoint)
            reading_dict = {
                "id": reading.id,
                "patient_id": patient.display_id,
                "event_timestamp": reading.event_timestamp.isoformat(),
                "heart_rate": reading.heart_rate,
                "spo2": reading.spo2,
                "systolic_bp": reading.systolic_bp,
                "diastolic_bp": reading.diastolic_bp,
                "respiratory_rate": reading.respiratory_rate,
                "temperature": reading.temperature,
                "quality_flags": reading.quality_flags,
                "risk_tier": prediction.final_tier,
                "decision_source": prediction.decision_source,
                "alert_created": alert is not None
            }
            await ws_manager.broadcast_patient_event(patient.display_id, "reading_update", reading_dict)

            if alert:
                alert_dict = {
                    "id": alert.id,
                    "patient_id": patient.display_id,
                    "severity": alert.severity,
                    "message": alert.message,
                    "status": alert.status,
                    "created_at": alert.created_at.isoformat()
                }
                await ws_manager.broadcast_patient_event(patient.display_id, "alert_triggered", alert_dict)

        results.append({"reading_id": reading.id, "is_new": is_new, "patient_id": p_id})

    return {"ingested_count": len(results), "records": results}


@router.get("/patients/{patient_id}/readings", response_model=List[VitalReadingResponse])
def get_readings_history(
    patient_id: str,
    limit: int = 100,
    skip: int = 0,
    db: Session = Depends(get_db)
):
    """Retrieve chronologically ordered vital readings for a patient."""
    patient = PatientService.get_by_id_or_display(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return ReadingService.get_patient_readings(db, patient_id=patient.id, limit=limit, skip=skip)
