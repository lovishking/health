"""
Synthetic Physiological Data Generator for RT-HDSS
Generates realistic, clearly labeled synthetic physiological time-series
for end-to-end testing, replay demonstrations, and software verification.

DISCLAIMER: Records produced by this module are purely synthetic simulations
and must never be treated as clinical ground truth.
"""

import math
import random
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any


def generate_synthetic_stream(
    patient_id: str,
    scenario: str = "deteriorating",
    num_steps: int = 30,
    interval_seconds: int = 10,
    start_time: datetime = None
) -> List[Dict[str, Any]]:
    """
    Generate a sequence of physiological readings under different simulation scenarios:
    - 'stable': Normal baseline vitals with stochastic physiological fluctuations.
    - 'deteriorating': Patient gradually develops hypoxemia and septic shock tachycardia.
    - 'critical_override': Patient abruptly enters critical bradycardia and hypotension.
    """
    if start_time is None:
        start_time = datetime.now(timezone.utc) - timedelta(seconds=num_steps * interval_seconds)

    records = []

    for i in range(num_steps):
        t = start_time + timedelta(seconds=i * interval_seconds)
        progress = i / max(1, num_steps - 1)

        if scenario == "stable":
            hr = 72 + 5 * math.sin(i * 0.4) + random.uniform(-2, 2)
            spo2 = 98 + random.uniform(-1, 1)
            sys_bp = 120 + 4 * math.sin(i * 0.3) + random.uniform(-3, 3)
            dia_bp = 80 + 3 * math.sin(i * 0.3) + random.uniform(-2, 2)
            resp = 16 + random.uniform(-1, 1)
            temp = 36.8 + random.uniform(-0.1, 0.1)

        elif scenario == "deteriorating":
            # Progresses from normal to critical hypoxemia and tachycardia
            hr = 75 + progress * 65 + random.uniform(-3, 3)  # Reaches ~140 bpm
            spo2 = 98 - progress * 17 + random.uniform(-1.5, 1.0)  # Drops to ~81%
            sys_bp = 120 - progress * 40 + random.uniform(-4, 4)  # Drops to ~80 mmHg
            dia_bp = 80 - progress * 25 + random.uniform(-3, 3)
            resp = 16 + progress * 16 + random.uniform(-1, 2)     # Rises to ~32/min
            temp = 37.0 + progress * 2.2 + random.uniform(-0.1, 0.2)  # Fever ~39.2 C

        elif scenario == "critical_override":
            # Severe bradycardia and hypoxemia triggering hard safety override
            hr = 70 - progress * 35 + random.uniform(-2, 2)  # Drops to ~35 bpm
            spo2 = 95 - progress * 16 + random.uniform(-1, 1)  # Drops to ~79%
            sys_bp = 115 - progress * 45 + random.uniform(-3, 3)  # Drops to ~70 mmHg
            dia_bp = 75 - progress * 30 + random.uniform(-2, 2)
            resp = 15 - progress * 8 + random.uniform(-1, 1)      # Drops to ~7/min
            temp = 36.5 - progress * 3.0 + random.uniform(-0.2, 0.1)  # Hypothermia ~33.5 C

        else:
            raise ValueError(f"Unknown scenario: {scenario}")

        record = {
            "patient_id": patient_id,
            "source": "synthetic",
            "source_event_id": f"syn-{patient_id}-{scenario}-{i:04d}",
            "event_timestamp": t.isoformat(),
            "heart_rate": round(max(25.0, min(240.0, hr)), 1),
            "spo2": round(max(50.0, min(100.0, spo2)), 1),
            "systolic_bp": round(max(40.0, min(220.0, sys_bp)), 1),
            "diastolic_bp": round(max(30.0, min(140.0, dia_bp)), 1),
            "respiratory_rate": round(max(4.0, min(60.0, resp)), 1),
            "temperature": round(max(30.0, min(42.0, temp)), 1),
        }
        records.append(record)

    return records


if __name__ == "__main__":
    stream = generate_synthetic_stream("DEMO-001", scenario="deteriorating", num_steps=5)
    import json
    print(json.dumps(stream, indent=2))
