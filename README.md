# Real-Time Healthcare Decision Support System (RT-HDSS)

[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![License: Academic Research](https://img.shields.io/badge/License-Academic_Research-purple.svg)]()

> **CLINICAL RESEARCH DISCLAIMER**:
> RT-HDSS is an academic research prototype designed to investigate real-time clinical telemetry streaming, multi-tier risk evaluation, explainability, and safety overrides. It does not provide medical diagnosis and must never be used as an autonomous life-critical decision maker without qualified healthcare supervision.

---

## 1. System Architecture

```
[ Historical ICU Replay / Synthetic Generator / BLE Wearable ]
                              │
                              ▼
                 [ Python Replay Engine ]
                              │ (REST Ingestion)
                              ▼
                  [ FastAPI Ingestion API ]
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     [ Range Validation ]             [ Idempotency ]
              │                               │
              └───────────────┬───────────────┘
                              ▼
            [ SQLite / PostgreSQL Persistent Store ]
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       [ XGBoost Static ]              [ LSTM Temporal ]
              │                               │
              └───────────────┬───────────────┘
                              ▼
                  [ Hybrid Fusion Model ]
                  P_H = α·P_S + (1-α)·P_T
                              │
                              ▼
              [ Clinical Safety Rule Override ]
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      [ SHAP Explanation ]            [ Alert Dispatched ]
              │                               │
              └───────────────┬───────────────┘
                              ▼
                 [ WebSocket Broadcaster ]
                              │
                              ▼
            [ React Clinician Monitoring Dashboard ]
```

---

## 2. Quickstart & Installation

### Prerequisites
- **Python**: 3.11+
- **Node.js**: v18+ or v20+ (Node v24 tested)
- **Git**

### Step 1: Clone and Set Up Virtual Environment

```bash
git clone <repo-url>
cd "health care system"

# Copy environment template
cp .env.example .env
```

### Step 2: Install Dependencies

**Backend:**
```bash
pip install -r backend/requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

---

## 3. Running the Application

### Start the Backend (Terminal 1)
```bash
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```
- Interactive API Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

### Start the Frontend Dashboard (Terminal 2)
```bash
cd frontend
npm run dev
```
- Clinician Dashboard: [http://localhost:5173](http://localhost:5173)

---

## 4. Running the Replay & Simulation Engine

You can stream physiological vitals directly from the web dashboard on the **Replay Engine** page (`http://localhost:5173/simulator`), or execute the CLI engine:

```bash
# Stream deteriorating sepsis/hypoxemia trajectory to patient DEMO-001
python -m simulator.replay_engine --patient DEMO-001 --scenario deteriorating --speed 1.0

# Stream critical bradycardia override trajectory
python -m simulator.replay_engine --patient DEMO-002 --scenario critical_override --speed 0.8
```

---

## 5. Running the Automated Test Suite

```bash
python -m pytest backend/tests -v
```

All 8 integration and unit tests cover:
1. System health and database connectivity.
2. Patient registration and duplicate conflict prevention.
3. Physiological reading ingestion and range plausibility flags.
4. Idempotent ingestion handling identical event keys.
5. Clinical safety override triggers and alert lifecycle.
