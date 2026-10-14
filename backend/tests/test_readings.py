from datetime import datetime, timezone

from app.models.notification import NotificationLog


def test_ingest_normal_reading(client):
    reading_payload = {
        "source": "synthetic",
        "source_event_id": "evt-normal-01",
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "heart_rate": 75.0,
        "spo2": 98.0,
        "systolic_bp": 120.0,
        "diastolic_bp": 80.0,
        "respiratory_rate": 16.0,
        "temperature": 37.0
    }
    response = client.post("/api/v1/patients/TEST-P01/readings", json=reading_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["heart_rate"] == 75.0
    assert data["spo2"] == 98.0

    # Verify risk status
    risk_resp = client.get("/api/v1/patients/TEST-P01/risk")
    assert risk_resp.status_code == 200
    risk_data = risk_resp.json()
    assert risk_data["final_tier"] == "Stable"


def test_safety_rule_override_and_alert(client):
    critical_payload = {
        "source": "synthetic",
        "source_event_id": "evt-crit-01",
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "heart_rate": 165.0,  # Critical tachycardia (>150)
        "spo2": 82.0,         # Critical hypoxemia (<85)
        "systolic_bp": 70.0,  # Critical hypotension (<75)
        "diastolic_bp": 45.0,
        "respiratory_rate": 38.0,
        "temperature": 37.2
    }
    response = client.post("/api/v1/patients/TEST-CRIT-01/readings", json=critical_payload)
    assert response.status_code == 201

    risk_resp = client.get("/api/v1/patients/TEST-CRIT-01/risk")
    assert risk_resp.status_code == 200
    risk_data = risk_resp.json()
    assert risk_data["final_tier"] == "Critical"
    assert risk_data["decision_source"] == "safety_override"

    # Verify alert was created
    alert_resp = client.get("/api/v1/patients/TEST-CRIT-01/alerts")
    assert alert_resp.status_code == 200
    alerts = alert_resp.json()
    assert len(alerts) >= 1
    assert alerts[0]["severity"] == "critical"
    assert alerts[0]["status"] == "active"

    # Acknowledge alert
    ack_resp = client.post(
        f"/api/v1/alerts/{alerts[0]['id']}/acknowledge",
        json={"acknowledged_by": "Dr. Smith"}
    )
    assert ack_resp.status_code == 200
    assert ack_resp.json()["status"] == "acknowledged"
    assert ack_resp.json()["acknowledged_by"] == "Dr. Smith"


def test_critical_alert_creates_email_notification_log(client, db_session, monkeypatch):
    class DummySmtp:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def starttls(self):
            pass

        def login(self, username, password):
            pass

        def send_message(self, message):
            pass

    monkeypatch.setattr("app.services.notification_service.smtplib.SMTP", DummySmtp)

    user_resp = client.post("/api/v1/users", json={
        "email": "critical-alerts@example.org",
        "display_name": "Critical Alerts Clinician",
        "role": "user",
        "password": "StrongPass123!"
    })
    assert user_resp.status_code == 201
    login_resp = client.post("/api/v1/users/login", json={
        "email": "critical-alerts@example.org",
        "password": "StrongPass123!"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    smtp_resp = client.put(
        "/api/v1/users/me/smtp",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "smtp_host": "smtp.example.org",
            "smtp_port": 587,
            "smtp_username": "critical-alerts@example.org",
            "smtp_password": "smtp-secret",
            "smtp_from_email": "critical-alerts@example.org",
            "smtp_from_name": "Critical Alerts",
            "smtp_use_tls": True,
            "smtp_enabled": True,
        }
    )
    assert smtp_resp.status_code == 200

    critical_payload = {
        "source": "synthetic",
        "source_event_id": "evt-email-critical-01",
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "heart_rate": 170.0,
        "spo2": 81.0,
        "systolic_bp": 72.0,
    }
    response = client.post("/api/v1/patients/TEST-EMAIL-CRIT/readings", json=critical_payload)
    assert response.status_code == 201

    alert_resp = client.get("/api/v1/patients/TEST-EMAIL-CRIT/alerts")
    assert alert_resp.status_code == 200
    alert_id = alert_resp.json()[0]["id"]

    logs = db_session.query(NotificationLog).filter(
        NotificationLog.alert_id == alert_id
    ).all()
    assert len(logs) == 1
    assert logs[0].channel == "smtp_email"
    assert logs[0].delivery_status == "delivered"
    assert logs[0].provider_message_id == "smtp:critical-alerts@example.org"


def test_idempotent_ingestion(client):
    payload = {
        "source": "physionet_replay",
        "source_event_id": "idempotent-event-999",
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "heart_rate": 88.0,
        "spo2": 96.0
    }
    # First post
    resp1 = client.post("/api/v1/patients/TEST-IDEM-01/readings", json=payload)
    assert resp1.status_code == 201
    reading_id_1 = resp1.json()["id"]

    # Second post with identical source_event_id
    resp2 = client.post("/api/v1/patients/TEST-IDEM-01/readings", json=payload)
    assert resp2.status_code == 201
    reading_id_2 = resp2.json()["id"]

    # Must return same reading without creating duplicate
    assert reading_id_1 == reading_id_2

    # Verify patient reading count is exactly 1
    history = client.get("/api/v1/patients/TEST-IDEM-01/readings")
    assert len(history.json()) == 1


def test_implausible_flags_without_dropping(client):
    payload = {
        "source": "synthetic",
        "source_event_id": "evt-implausible-01",
        "event_timestamp": datetime.now(timezone.utc).isoformat(),
        "heart_rate": 350.0,  # Exceeds 300 bpm
        "spo2": 95.0
    }
    resp = client.post("/api/v1/patients/TEST-FLAGS-01/readings", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert "quality_flags" in data
    assert "heart_rate" in data["quality_flags"]
