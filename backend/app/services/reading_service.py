import json
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models.reading import VitalReading
from app.schemas.reading import VitalReadingCreate


class ReadingService:
    @staticmethod
    def validate_and_flag_vitals(reading_in: VitalReadingCreate) -> Dict[str, Any]:
        """
        Validate plausible physiological boundaries and flag anomalies without dropping records:
        - Heart Rate: 20-300 bpm
        - SpO2: 40-100%
        - Systolic BP: 40-300 mmHg
        - Diastolic BP: 20-200 mmHg
        - Respiratory Rate: 4-80 bpm
        - Temperature: 25.0-45.0 C
        """
        flags: Dict[str, str] = {}

        if reading_in.heart_rate is not None:
            if reading_in.heart_rate < 20 or reading_in.heart_rate > 300:
                flags["heart_rate"] = f"Physiologically implausible ({reading_in.heart_rate} bpm)"
        else:
            flags["heart_rate_missing"] = "Missing observation"

        if reading_in.spo2 is not None:
            if reading_in.spo2 < 40 or reading_in.spo2 > 100:
                flags["spo2"] = f"Physiologically implausible ({reading_in.spo2}%)"
        else:
            flags["spo2_missing"] = "Missing observation"

        if reading_in.systolic_bp is not None:
            if reading_in.systolic_bp < 40 or reading_in.systolic_bp > 300:
                flags["systolic_bp"] = f"Physiologically implausible ({reading_in.systolic_bp} mmHg)"

        if reading_in.diastolic_bp is not None:
            if reading_in.diastolic_bp < 20 or reading_in.diastolic_bp > 200:
                flags["diastolic_bp"] = f"Physiologically implausible ({reading_in.diastolic_bp} mmHg)"

        if reading_in.respiratory_rate is not None:
            if reading_in.respiratory_rate < 4 or reading_in.respiratory_rate > 80:
                flags["respiratory_rate"] = f"Physiologically implausible ({reading_in.respiratory_rate}/min)"

        if reading_in.temperature is not None:
            if reading_in.temperature < 25.0 or reading_in.temperature > 45.0:
                flags["temperature"] = f"Physiologically implausible ({reading_in.temperature} C)"

        return flags

    @staticmethod
    def ingest_reading(
        db: Session,
        patient_id: str,
        reading_in: VitalReadingCreate
    ) -> Tuple[VitalReading, bool]:
        """
        Ingest reading with idempotency check.
        Returns: (VitalReading, is_new: bool)
        """
        # Idempotency check on (patient_id, source, source_event_id)
        if reading_in.source_event_id:
            existing = db.query(VitalReading).filter(
                VitalReading.patient_id == patient_id,
                VitalReading.source == reading_in.source,
                VitalReading.source_event_id == reading_in.source_event_id
            ).first()
            if existing:
                return existing, False

        flags = ReadingService.validate_and_flag_vitals(reading_in)
        quality_flags_str = json.dumps(flags) if flags else None

        # Ensure timestamp has timezone
        event_time = reading_in.event_timestamp
        if event_time.tzinfo is None:
            event_time = event_time.replace(tzinfo=timezone.utc)

        reading = VitalReading(
            patient_id=patient_id,
            source=reading_in.source,
            source_event_id=reading_in.source_event_id,
            event_timestamp=event_time,
            heart_rate=reading_in.heart_rate,
            spo2=reading_in.spo2,
            systolic_bp=reading_in.systolic_bp,
            diastolic_bp=reading_in.diastolic_bp,
            respiratory_rate=reading_in.respiratory_rate,
            temperature=reading_in.temperature,
            quality_flags=quality_flags_str
        )
        db.add(reading)
        db.commit()
        db.refresh(reading)
        return reading, True

    @staticmethod
    def get_patient_readings(
        db: Session,
        patient_id: str,
        limit: int = 50,
        skip: int = 0
    ) -> List[VitalReading]:
        return db.query(VitalReading).filter(
            VitalReading.patient_id == patient_id
        ).order_by(VitalReading.event_timestamp.desc()).offset(skip).limit(limit).all()
