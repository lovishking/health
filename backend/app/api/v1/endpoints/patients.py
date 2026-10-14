from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.patient import PatientCreate, PatientResponse
from app.schemas.prediction import RiskPredictionResponse
from app.services.patient_service import PatientService
from app.models.prediction import RiskPrediction

router = APIRouter()


@router.get("", response_model=List[PatientResponse])
def get_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all registered patients with their latest status and alert counts."""
    return PatientService.list_patients(db=db, skip=skip, limit=limit)


@router.post("/seed", status_code=status.HTTP_200_OK)
def seed_demo_patients(db: Session = Depends(get_db)):
    """Endpoint to seed real clinical users and patients for demo and real-time monitoring."""
    from scripts.seed_demo import seed_database
    seed_database()
    return {"status": "success", "message": "Clinical patients and users seeded successfully"}


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(patient_in: PatientCreate, db: Session = Depends(get_db)):
    """Create a new patient record."""
    existing = PatientService.get_by_id_or_display(db, patient_in.display_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Patient with display_id '{patient_in.display_id}' already exists."
        )
    patient = PatientService.create_patient(db=db, patient_in=patient_in)
    return PatientResponse(
        id=patient.id,
        display_id=patient.display_id,
        display_name=patient.display_name,
        status=patient.status,
        created_at=patient.created_at,
        latest_reading_time=None,
        latest_tier="Unknown",
        active_alerts_count=0
    )


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    """Get single patient details by id or display_id."""
    patient = PatientService.get_by_id_or_display(db, patient_id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{patient_id}' not found."
        )
    # Get latest info
    summary = PatientService.list_patients(db, skip=0, limit=1000)
    for p in summary:
        if p.id == patient.id:
            return p
    return PatientResponse.from_orm(patient)


@router.get("/{patient_id}/risk", response_model=RiskPredictionResponse)
def get_patient_latest_risk(patient_id: str, db: Session = Depends(get_db)):
    """Get latest risk prediction assessment for the given patient."""
    patient = PatientService.get_by_id_or_display(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    latest_pred = db.query(RiskPrediction).filter(
        RiskPrediction.patient_id == patient.id
    ).order_by(RiskPrediction.created_at.desc()).first()

    if not latest_pred:
        raise HTTPException(
            status_code=404,
            detail="No risk assessment has been performed yet for this patient."
        )
    return latest_pred


@router.get("/{patient_id}/predictions", response_model=List[RiskPredictionResponse])
def get_patient_predictions(patient_id: str, limit: int = 50, db: Session = Depends(get_db)):
    """Get historical risk predictions for a patient."""
    patient = PatientService.get_by_id_or_display(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return db.query(RiskPrediction).filter(
        RiskPrediction.patient_id == patient.id
    ).order_by(RiskPrediction.created_at.desc()).limit(limit).all()
