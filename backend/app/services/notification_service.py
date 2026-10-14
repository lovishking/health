import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from typing import List, Tuple

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.notification import NotificationLog
from app.models.patient import Patient
from app.models.user import User


class NotificationService:
    @staticmethod
    def get_critical_email_recipients(db: Session) -> List[User]:
        """Return active users who configured SMTP for critical alert email."""
        return db.query(User).filter(
            User.is_active.is_(True),
            User.email.isnot(None),
            User.smtp_enabled.is_(True),
            User.smtp_host.isnot(None),
            User.smtp_password.isnot(None),
            User.smtp_from_email.isnot(None),
        ).all()

    @staticmethod
    def smtp_configured(user: User) -> bool:
        return bool(
            user.smtp_enabled
            and user.smtp_host
            and user.smtp_password
            and user.smtp_from_email
        )

    @staticmethod
    def send_critical_alert_emails(db: Session, alert: Alert) -> List[NotificationLog]:
        if alert.severity != "critical":
            return []

        recipients = NotificationService.get_critical_email_recipients(db)
        if not recipients:
            log = NotificationLog(
                alert_id=alert.id,
                channel="email",
                delivery_status="failed",
                provider_message_id="no-active-email-recipients",
            )
            db.add(log)
            db.commit()
            return [log]

        patient = db.query(Patient).filter(Patient.id == alert.patient_id).first()
        logs: List[NotificationLog] = []

        for recipient in recipients:
            if NotificationService.smtp_configured(recipient):
                status, provider_id = NotificationService._send_smtp_email(
                    recipient=recipient,
                    alert=alert,
                    patient=patient,
                )
            else:
                status = "mocked"
                provider_id = f"mock-email:{recipient.email}"

            log = NotificationLog(
                alert_id=alert.id,
                channel="smtp_email" if NotificationService.smtp_configured(recipient) else "mock_email",
                delivery_status=status,
                provider_message_id=provider_id,
            )
            db.add(log)
            logs.append(log)

        db.commit()
        return logs

    @staticmethod
    def _send_smtp_email(
        recipient: User,
        alert: Alert,
        patient: Patient | None,
    ) -> Tuple[str, str]:
        patient_label = patient.display_id if patient else alert.patient_id
        subject = f"CRITICAL RT-HDSS Alert: {patient_label}"
        greeting_name = recipient.display_name or "Clinician"
        body = (
            f"Hello {greeting_name},\n\n"
            "A critical patient alert was generated automatically by RT-HDSS.\n\n"
            f"Patient: {patient_label}\n"
            f"Severity: {alert.severity.upper()}\n"
            f"Alert: {alert.message}\n"
            f"Created at: {alert.created_at.isoformat()}\n\n"
            "Clinical research disclaimer: this is a decision-support notification "
            "and requires review by qualified healthcare personnel.\n"
        )

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = formataddr((recipient.smtp_from_name or "RT-HDSS Clinical Alerts", recipient.smtp_from_email))
        message["To"] = recipient.email
        message.set_content(body)

        try:
            with smtplib.SMTP(recipient.smtp_host, int(recipient.smtp_port or 587), timeout=15) as smtp:
                if recipient.smtp_use_tls:
                    smtp.starttls()
                if recipient.smtp_username:
                    smtp.login(recipient.smtp_username, recipient.smtp_password)
                smtp.send_message(message)
            return "delivered", f"smtp:{recipient.email}"
        except Exception as exc:
            return "failed", f"smtp-error:{type(exc).__name__}:{recipient.email}"
