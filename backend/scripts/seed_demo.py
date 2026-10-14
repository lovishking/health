"""
Database Seeder for RT-HDSS
Populates realistic clinicians (Users) and ICU beds/patients with baseline vitals and risk profiles.
"""

import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.user import User
from app.models.patient import Patient
from app.models.reading import VitalReading
from app.models.prediction import RiskPrediction
from app.models.alert import Alert
from app.core.security import hash_password
from app.services.reading_service import ReadingService
from app.services.assessment_service import AssessmentService
from app.services.alert_service import AlertService


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("[SEED] Starting clinical database seed...")

    # 1. Clinician Users
    users_data = [
        {"email": "dr.arman@hospital.org", "role": "intensivist", "password": "HospitalSecure2026!"},
        {"email": "nurse.sarah@hospital.org", "role": "icu_nurse", "password": "HospitalSecure2026!"},
        {"email": "dr.chen@hospital.org", "role": "cardiologist", "password": "HospitalSecure2026!"},
    ]

    for u in users_data:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            user = User(
                email=u["email"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                is_active=True
            )
            db.add(user)
            print(f"  + User created: {u['email']} ({u['role']})")
    db.commit()

    # 2. Realistic Patients
    patients_data = [
        {
            "display_id": "ICU-BED-101",
            "display_name": "John Doe (Post-Cardiac Sepsis)",
            "scenario": "deteriorating",
            "vitals": {"hr": 138.0, "spo2": 88.0, "sys": 88.0, "dia": 56.0, "resp": 28.0, "temp": 39.1}
        },
        {
            "display_id": "ICU-BED-102",
            "display_name": "Sarah Jenkins (Severe Hypoxemia ARDS)",
            "scenario": "critical",
            "vitals": {"hr": 158.0, "spo2": 81.0, "sys": 72.0, "dia": 44.0, "resp": 38.0, "temp": 39.6}
        },
        {
            "display_id": "ICU-BED-103",
            "display_name": "Marcus Vance (Post-Op Trauma)",
            "scenario": "stable",
            "vitals": {"hr": 74.0, "spo2": 98.0, "sys": 118.0, "dia": 78.0, "resp": 15.0, "temp": 36.8}
        },
        {
            "display_id": "ICU-BED-104",
            "display_name": "Emily Watson (Cardiac Telemetry)",
            "scenario": "warning",
            "vitals": {"hr": 115.0, "spo2": 91.0, "sys": 148.0, "dia": 92.0, "resp": 22.0, "temp": 37.6}
        },
    ]

    now = datetime.now(timezone.utc)

    for p_info in patients_data:
        patient = db.query(Patient).filter(Patient.display_id == p_info["display_id"]).first()
        if not patient:
            patient = Patient(
                display_id=p_info["display_id"],
                display_name=p_info["display_name"],
                status="active"
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)
            print(f"  + Patient created: {p_info['display_id']} - {p_info['display_name']}")

        # Seed 10 baseline readings over the past 2 hours
        v = p_info["vitals"]
        for step in range(10):
            t = now - timedelta(minutes=(10 - step) * 12)
            # Add small random variation
            reading = VitalReading(
                patient_id=patient.id,
                source="icu_monitor",
                source_event_id=f"seed-{patient.display_id}-{step}",
                event_timestamp=t,
                heart_rate=round(v["hr"] + (step - 5) * 1.5, 1),
                spo2=round(max(60.0, min(100.0, v["spo2"] - (step - 5) * 0.8)), 1),
                systolic_bp=round(v["sys"] - (step - 5) * 1.2, 1),
                diastolic_bp=round(v["dia"] - (step - 5) * 0.8, 1),
                respiratory_rate=round(v["resp"] + (step - 5) * 0.5, 1),
                temperature=round(v["temp"] + (step - 5) * 0.05, 1)
            )
            # Check idempotency
            existing_reading = db.query(VitalReading).filter(
                VitalReading.patient_id == patient.id,
                VitalReading.source_event_id == reading.source_event_id
            ).first()
            if not existing_reading:
                db.add(reading)
                db.commit()
                db.refresh(reading)

                # Assess reading
                prediction = AssessmentService.evaluate_reading(db, reading)
                AlertService.process_prediction_for_alerts(db, prediction)

    db.close()
    print("[SEED] Successfully populated real ICU users, patients, baseline vitals, and alert history!\n")


if __name__ == "__main__":
    seed_database()
