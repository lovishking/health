import json
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.alert import Alert
from app.models.notification import NotificationLog
from app.models.prediction import RiskPrediction
from app.services.notification_service import NotificationService


class AlertService:
    @staticmethod
    def process_prediction_for_alerts(
        db: Session,
        prediction: RiskPrediction,
        cooldown_minutes: int = 5
    ) -> Optional[Alert]:
        """
        Evaluate if prediction warrants an alert with deduplication and cooldown.
        Only generates alerts for Warning and Critical tiers.
        """
        if prediction.final_tier not in ["Warning", "Critical"]:
            return None

        severity = "critical" if prediction.final_tier == "Critical" else "warning"

        # Check deduplication / cooldown
        cooldown_threshold = datetime.now(timezone.utc) - timedelta(minutes=cooldown_minutes)
        existing_alert = db.query(Alert).filter(
            Alert.patient_id == prediction.patient_id,
            Alert.severity == severity,
            Alert.status == "active",
            Alert.created_at >= cooldown_threshold
        ).first()

        if existing_alert:
            # Active alert already exists within cooldown
            return None

        # Build message from explanation
        explanation_text = "Deterioration detected."
        try:
            exp_data = json.loads(prediction.explanation)
            rules = exp_data.get("triggered_rules", [])
            if rules:
                explanation_text = ", ".join(rules)
        except Exception:
            pass

        alert_message = f"[{prediction.final_tier.upper()}] Patient risk tier elevated: {explanation_text}"

        alert = Alert(
            patient_id=prediction.patient_id,
            prediction_id=prediction.id,
            severity=severity,
            message=alert_message,
            status="active"
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        if severity == "critical":
            NotificationService.send_critical_alert_emails(db=db, alert=alert)
        else:
            notif = NotificationLog(
                alert_id=alert.id,
                channel="websocket",
                delivery_status="delivered",
                provider_message_id=f"ws-{alert.id[:8]}"
            )
            db.add(notif)
            db.commit()

        return alert

    @staticmethod
    def acknowledge_alert(
        db: Session,
        alert_id: str,
        acknowledged_by: str
    ) -> Optional[Alert]:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            return None
        alert.status = "acknowledged"
        alert.acknowledged_by = acknowledged_by
        alert.acknowledged_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(alert)
        return alert

    @staticmethod
    def get_patient_alerts(
        db: Session,
        patient_id: str,
        limit: int = 50
    ) -> List[Alert]:
        return db.query(Alert).filter(
            Alert.patient_id == patient_id
        ).order_by(Alert.created_at.desc()).limit(limit).all()
