from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.patient import Patient
from app.models.reading import VitalReading
from app.models.prediction import RiskPrediction
from app.models.alert import Alert
from app.schemas.patient import PatientCreate, PatientResponse


class PatientService:
    @staticmethod
    def get_by_id_or_display(db: Session, patient_id: str) -> Optional[Patient]:
        """Fetch patient either by UUID id or display_id."""
        return db.query(Patient).filter(
            (Patient.id == patient_id) | (Patient.display_id == patient_id)
        ).first()

    @staticmethod
    def get_or_create(db: Session, display_id: str, display_name: Optional[str] = None) -> Patient:
        patient = PatientService.get_by_id_or_display(db, display_id)
        if not patient:
            patient = Patient(
                display_id=display_id,
                display_name=display_name or f"Patient {display_id}",
                status="active"
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)
        return patient

    @staticmethod
    def create_patient(db: Session, patient_in: PatientCreate) -> Patient:
        patient = Patient(
            id=patient_in.id or None,
            display_id=patient_in.display_id,
            display_name=patient_in.display_name or f"Patient {patient_in.display_id}",
            status=patient_in.status or "active"
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        return patient

    @staticmethod
    def list_patients(db: Session, skip: int = 0, limit: int = 100) -> List[PatientResponse]:
        patients = db.query(Patient).offset(skip).limit(limit).all()
        result = []
        for p in patients:
            # Latest reading timestamp
            latest_reading = db.query(VitalReading).filter(
                VitalReading.patient_id == p.id
            ).order_by(VitalReading.event_timestamp.desc()).first()

            # Latest prediction tier
            latest_pred = db.query(RiskPrediction).filter(
                RiskPrediction.patient_id == p.id
            ).order_by(RiskPrediction.created_at.desc()).first()

            # Active alerts count
            active_alerts = db.query(func.count(Alert.id)).filter(
                Alert.patient_id == p.id,
                Alert.status == "active"
            ).scalar() or 0

            resp = PatientResponse(
                id=p.id,
                display_id=p.display_id,
                display_name=p.display_name,
                status=p.status,
                created_at=p.created_at,
                latest_reading_time=latest_reading.event_timestamp if latest_reading else None,
                latest_tier=latest_pred.final_tier if latest_pred else "Unknown",
                active_alerts_count=active_alerts
            )
            result.append(resp)
        return result
