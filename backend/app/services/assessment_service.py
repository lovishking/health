import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.reading import VitalReading
from app.models.prediction import RiskPrediction


class AssessmentService:
    @staticmethod
    def evaluate_reading(
        db: Session,
        reading: VitalReading
    ) -> RiskPrediction:
        """
        Evaluate a vital reading using provisional clinical rules and safety overrides.
        Clearly labels rule-based output as preliminary / pre-clinical research prototype.
        """
        # Safety rule override checks
        override_triggered = False
        override_reasons = []

        # Check SpO2
        if reading.spo2 is not None and reading.spo2 < 85.0:
            override_triggered = True
            override_reasons.append(f"Critical Hypoxemia (SpO2: {reading.spo2}% < 85%)")

        # Check Heart Rate
        if reading.heart_rate is not None:
            if reading.heart_rate > 150.0:
                override_triggered = True
                override_reasons.append(f"Severe Tachycardia (HR: {reading.heart_rate} bpm > 150)")
            elif reading.heart_rate < 40.0:
                override_triggered = True
                override_reasons.append(f"Severe Bradycardia (HR: {reading.heart_rate} bpm < 40)")

        # Check Blood Pressure
        if reading.systolic_bp is not None:
            if reading.systolic_bp < 75.0:
                override_triggered = True
                override_reasons.append(f"Severe Hypotension (Sys BP: {reading.systolic_bp} mmHg < 75)")
            elif reading.systolic_bp > 210.0:
                override_triggered = True
                override_reasons.append(f"Hypertensive Crisis (Sys BP: {reading.systolic_bp} mmHg > 210)")

        # Check Respiratory Rate
        if reading.respiratory_rate is not None:
            if reading.respiratory_rate > 35.0:
                override_triggered = True
                override_reasons.append(f"Severe Tachypnea (Resp: {reading.respiratory_rate}/min > 35)")
            elif reading.respiratory_rate < 8.0:
                override_triggered = True
                override_reasons.append(f"Severe Bradypnea (Resp: {reading.respiratory_rate}/min < 8)")

        # Check Temperature
        if reading.temperature is not None:
            if reading.temperature > 40.5:
                override_triggered = True
                override_reasons.append(f"Hyperpyrexia (Temp: {reading.temperature} C > 40.5)")
            elif reading.temperature < 34.0:
                override_triggered = True
                override_reasons.append(f"Severe Hypothermia (Temp: {reading.temperature} C < 34.0)")

        if override_triggered:
            final_tier = "Critical"
            decision_source = "safety_override"
            model_tier = "Critical"
            stable_p, warn_p, crit_p = 0.05, 0.15, 0.80
            explanation_dict = {
                "type": "safety_override",
                "status": "RESEARCH_PROTOTYPE_ALERT",
                "clinical_disclaimer": "Provisional research threshold; requires qualified clinical review.",
                "triggered_rules": override_reasons,
                "confidence": "High (Rule Override)",
            }
        else:
            # Check warning signs
            warning_reasons = []
            if reading.spo2 is not None and 85.0 <= reading.spo2 <= 92.0:
                warning_reasons.append(f"Borderline SpO2 ({reading.spo2}%)")
            if reading.heart_rate is not None and (110.0 <= reading.heart_rate <= 150.0 or 40.0 <= reading.heart_rate <= 50.0):
                warning_reasons.append(f"Elevated/Depressed Heart Rate ({reading.heart_rate} bpm)")
            if reading.systolic_bp is not None and (75.0 <= reading.systolic_bp <= 90.0 or 160.0 <= reading.systolic_bp <= 210.0):
                warning_reasons.append(f"Abnormal Systolic BP ({reading.systolic_bp} mmHg)")
            if reading.respiratory_rate is not None and (24.0 <= reading.respiratory_rate <= 35.0):
                warning_reasons.append(f"Elevated Respiratory Rate ({reading.respiratory_rate}/min)")
            if reading.temperature is not None and (38.5 <= reading.temperature <= 40.5 or 34.0 <= reading.temperature <= 35.5):
                warning_reasons.append(f"Abnormal Temperature ({reading.temperature} C)")

            # Check if all vitals are None
            all_vitals = [reading.heart_rate, reading.spo2, reading.systolic_bp, reading.diastolic_bp, reading.respiratory_rate, reading.temperature]
            if all(v is None for v in all_vitals):
                final_tier = "Stable"
                model_tier = "Insufficient_Data"
                decision_source = "insufficient_data"
                stable_p, warn_p, crit_p = None, None, None
                explanation_dict = {
                    "type": "insufficient_data",
                    "status": "NO_VITALS_PRESENT",
                    "clinical_disclaimer": "No physiological vitals observed in reading.",
                    "triggered_rules": [],
                }
            elif len(warning_reasons) > 0:
                final_tier = "Warning"
                decision_source = "rules_provisional"
                model_tier = "Warning"
                stable_p, warn_p, crit_p = 0.20, 0.65, 0.15
                explanation_dict = {
                    "type": "provisional_rules",
                    "status": "RESEARCH_PROVISIONAL_WARNING",
                    "clinical_disclaimer": "Provisional research threshold; requires qualified clinical review.",
                    "triggered_rules": warning_reasons,
                    "confidence": "Moderate (Rule-Based)",
                }
            else:
                final_tier = "Stable"
                decision_source = "rules_provisional"
                model_tier = "Stable"
                stable_p, warn_p, crit_p = 0.85, 0.12, 0.03
                explanation_dict = {
                    "type": "provisional_rules",
                    "status": "NORMAL_VITALS_RANGE",
                    "clinical_disclaimer": "Provisional research threshold; requires qualified clinical review.",
                    "triggered_rules": ["All recorded parameters within normal limits"],
                    "confidence": "Normal",
                }

        prediction = RiskPrediction(
            patient_id=reading.patient_id,
            reading_id=reading.id,
            model_version="rules_provisional_v1.0",
            stable_probability=stable_p,
            warning_probability=warn_p,
            critical_probability=crit_p,
            model_tier=model_tier,
            final_tier=final_tier,
            decision_source=decision_source,
            explanation=json.dumps(explanation_dict)
        )
        db.add(prediction)
        db.commit()
        db.refresh(prediction)
        return prediction
