# RT-HDSS System Architecture & Clinical Data Flow

## 1. Overview
The **Real-Time Healthcare Decision Support System (RT-HDSS)** is an early-warning prototype designed to process streaming physiological vital signs, evaluate patient deterioration risk, provide explainable decisions, and display live updates on a clinician-facing dashboard.

> **CLINICAL DISCLAIMER**: This application is an academic research prototype. It does not provide medical diagnosis, nor does it predict patient survival with mathematical certainty. All alerts and outputs must be reviewed by qualified clinical healthcare personnel.

---

## 2. End-to-End Pipeline

```
[ Historical ICU Data / Synthetic Generator / BLE Wearable ]
                          │
                          ▼
            [ Python Replay Engine (simulator) ]
                          │  (REST POST)
                          ▼
             [ FastAPI Ingestion API ]
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
 [ Range & Plausibility Checks ]   [ Idempotency Filter ]
          │                               │
          └───────────────┬───────────────┘
                          ▼
        [ Persistence (SQLite / PostgreSQL) ]
                          │
                          ▼
          [ Sliding Buffer (Redis / In-Memory) ]
                          │
       ┌──────────────────┴──────────────────┐
       ▼                                     ▼
[ Static Snapshot (XGBoost) ]       [ Temporal Model (LSTM) ]
       │                                     │
       └──────────────────┬──────────────────┘
                          ▼
              [ Hybrid Decision Fusion ]
              P_H(c) = α·P_S(c) + (1-α)·P_T(c)
                          │
                          ▼
          [ Clinical Safety Rule Override ]
         (SpO2 < 85%, HR > 150/ < 40, BP, Temp)
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
 [ Explainability (TreeSHAP) ]    [ Alert Deduplication & Cooldown ]
          │                               │
          └───────────────┬───────────────┘
                          ▼
             [ Audit Log Persistence ]
                          │
                          ▼
          [ WebSocket Event Broadcaster ]
                          │
                          ▼
       [ React Clinician Monitoring Dashboard ]
```

---

## 3. Core Database Entities
- **`patients`**: Master index of monitored patient identifiers.
- **`vital_readings`**: Timestamped physiological measurements (HR, SpO2, Sys/Dia BP, Resp Rate, Temp, quality flags).
- **`risk_predictions`**: Calibrated risk probabilities, final tiers (Stable, Warning, Critical), decision sources, and SHAP/rule explanations.
- **`alerts`**: Active, acknowledged, and resolved clinical alerts.
- **`notification_logs`**: Multi-channel delivery audits (mock SMS, Twilio, WebSocket).
- **`audit_logs`**: Immutable audit logs of all actions and overrides.
