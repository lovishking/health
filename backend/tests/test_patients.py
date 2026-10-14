def test_create_and_get_patient(client):
    payload = {
        "display_id": "TEST-PAT-001",
        "display_name": "Test Patient Alpha",
        "status": "active"
    }
    response = client.post("/api/v1/patients", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["display_id"] == "TEST-PAT-001"
    assert data["display_name"] == "Test Patient Alpha"
    assert "id" in data

    # Retrieve patient by display_id
    get_resp = client.get("/api/v1/patients/TEST-PAT-001")
    assert get_resp.status_code == 200
    assert get_resp.json()["display_id"] == "TEST-PAT-001"


def test_duplicate_patient_conflict(client):
    payload = {
        "display_id": "TEST-DUP-001",
        "display_name": "Test Patient Duplication"
    }
    resp1 = client.post("/api/v1/patients", json=payload)
    assert resp1.status_code == 201

    resp2 = client.post("/api/v1/patients", json=payload)
    assert resp2.status_code == 409
