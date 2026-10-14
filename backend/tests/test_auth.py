def register(client, email, password, role="user"):
    return client.post("/api/v1/users", json={
        "email": email,
        "display_name": email.split("@")[0],
        "role": role,
        "password": password,
    })


def login(client, email, password):
    response = client.post("/api/v1/users/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_first_user_is_admin_and_can_view_all_users(client):
    admin_resp = register(client, "admin@example.org", "AdminPass123!", role="user")
    assert admin_resp.status_code == 201
    assert admin_resp.json()["role"] == "admin"

    user_resp = register(client, "user@example.org", "UserPass123!", role="user")
    assert user_resp.status_code == 201
    assert user_resp.json()["role"] == "user"

    token = login(client, "admin@example.org", "AdminPass123!")
    users_resp = client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})

    assert users_resp.status_code == 200
    assert len(users_resp.json()) == 2
    assert "password_hash" not in users_resp.json()[0]
    assert "smtp_password" not in users_resp.json()[0]


def test_non_admin_cannot_view_all_users(client):
    register(client, "admin@example.org", "AdminPass123!", role="admin")
    register(client, "user@example.org", "UserPass123!", role="user")

    token = login(client, "user@example.org", "UserPass123!")
    users_resp = client.get("/api/v1/users", headers={"Authorization": f"Bearer {token}"})

    assert users_resp.status_code == 403


def test_user_can_save_own_smtp_settings(client):
    register(client, "smtp-user@example.org", "UserPass123!", role="user")
    token = login(client, "smtp-user@example.org", "UserPass123!")

    response = client.put(
        "/api/v1/users/me/smtp",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "smtp_host": "smtp.example.org",
            "smtp_port": 587,
            "smtp_username": "smtp-user@example.org",
            "smtp_password": "smtp-secret",
            "smtp_from_email": "smtp-user@example.org",
            "smtp_from_name": "RT-HDSS Alerts",
            "smtp_use_tls": True,
            "smtp_enabled": True,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["smtp_enabled"] is True
    assert data["smtp_host"] == "smtp.example.org"
    assert "smtp_password" not in data
