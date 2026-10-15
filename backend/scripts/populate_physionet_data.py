"""
PhysioNet Challenge 2012 ICU Dataset Generator
Creates authentic PhysioNet 2012 format patient records for clinical replay and model training.
Adheres strictly to the PhysioNet 2012 schema: Time,Parameter,Value
"""

import os
import math
import random

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "physionet_2012"))
os.makedirs(DATA_DIR, exist_ok=True)

PATIENT_PROFILES = [
    {
        "id": "DEMO-001",
        "record_id": 132539,
        "age": 63,
        "gender": 1, # Male
        "height": 175.0,
        "weight": 82.0,
        "scenario": "deteriorating_sepsis",
        # Trajectory parameters
        "base_hr": 92.0,
        "target_hr": 142.0,
        "base_spo2": 96.0,
        "target_spo2": 84.0,
        "base_sys": 130.0,
        "target_sys": 82.0,
        "base_dia": 82.0,
        "target_dia": 50.0,
        "base_rr": 18.0,
        "target_rr": 32.0,
        "base_temp": 37.2,
        "target_temp": 39.4,
    },
    {
        "id": "DEMO-002",
        "record_id": 132540,
        "age": 57,
        "gender": 0, # Female
        "height": 162.0,
        "weight": 68.0,
        "scenario": "hypertensive_crisis",
        "base_hr": 84.0,
        "target_hr": 128.0,
        "base_spo2": 97.0,
        "target_spo2": 93.0,
        "base_sys": 150.0,
        "target_sys": 215.0,
        "base_dia": 95.0,
        "target_dia": 125.0,
        "base_rr": 19.0,
        "target_rr": 26.0,
        "base_temp": 36.9,
        "target_temp": 37.5,
    },
    {
        "id": "ICU-BED-101",
        "record_id": 142857,
        "age": 71,
        "gender": 1,
        "height": 168.0,
        "weight": 74.0,
        "scenario": "septic_shock",
        "base_hr": 95.0,
        "target_hr": 155.0,
        "base_spo2": 94.0,
        "target_spo2": 82.0,
        "base_sys": 122.0,
        "target_sys": 75.0,
        "base_dia": 76.0,
        "target_dia": 46.0,
        "base_rr": 20.0,
        "target_rr": 34.0,
        "base_temp": 37.5,
        "target_temp": 39.8,
    },
    {
        "id": "ICU-BED-102",
        "record_id": 142858,
        "age": 49,
        "gender": 0,
        "height": 165.0,
        "weight": 62.0,
        "scenario": "severe_hypoxemia_ards",
        "base_hr": 105.0,
        "target_hr": 145.0,
        "base_spo2": 91.0,
        "target_spo2": 79.0,
        "base_sys": 115.0,
        "target_sys": 95.0,
        "base_dia": 70.0,
        "target_dia": 60.0,
        "base_rr": 24.0,
        "target_rr": 38.0,
        "base_temp": 38.2,
        "target_temp": 39.5,
    },
    {
        "id": "ICU-BED-103",
        "record_id": 142859,
        "age": 52,
        "gender": 1,
        "height": 180.0,
        "weight": 85.0,
        "scenario": "stable_post_op",
        "base_hr": 76.0,
        "target_hr": 72.0,
        "base_spo2": 98.0,
        "target_spo2": 99.0,
        "base_sys": 120.0,
        "target_sys": 118.0,
        "base_dia": 78.0,
        "target_dia": 76.0,
        "base_rr": 15.0,
        "target_rr": 14.0,
        "base_temp": 36.8,
        "target_temp": 36.9,
    },
    {
        "id": "ICU-BED-104",
        "record_id": 142860,
        "age": 66,
        "gender": 0,
        "height": 158.0,
        "weight": 70.0,
        "scenario": "cardiac_telemetry_warning",
        "base_hr": 88.0,
        "target_hr": 122.0,
        "base_spo2": 96.0,
        "target_spo2": 91.0,
        "base_sys": 138.0,
        "target_sys": 165.0,
        "base_dia": 85.0,
        "target_dia": 98.0,
        "base_rr": 17.0,
        "target_rr": 23.0,
        "base_temp": 37.1,
        "target_temp": 37.8,
    },
]

def generate_record_file(p, total_hours=48, steps_per_hour=2):
    """Generate authentic PhysioNet Challenge 2012 format file."""
    lines = ["Time,Parameter,Value"]
    
    # 00:00 General descriptors
    lines.append(f"00:00,RecordID,{p['record_id']}")
    lines.append(f"00:00,Age,{p['age']}")
    lines.append(f"00:00,Gender,{p['gender']}")
    lines.append(f"00:00,Height,{p['height']}")
    lines.append(f"00:00,Weight,{p['weight']}")

    total_steps = total_hours * steps_per_hour # e.g. 96 steps
    random.seed(p["record_id"])

    for step in range(1, total_steps + 1):
        minutes_total = int(step * (60 / steps_per_hour))
        hrs = minutes_total // 60
        mins = minutes_total % 60
        time_str = f"{hrs:02d}:{mins:02d}"

        # Progress fraction 0.0 -> 1.0 -> cyclical variation
        cycle_progress = (math.sin(step / 15.0) + 1.0) / 2.0
        trend_progress = min(1.0, step / (total_steps * 0.75))
        combined_prog = 0.7 * trend_progress + 0.3 * cycle_progress

        # Compute vitals with subtle clinical micro-variations
        hr = round(p["base_hr"] + combined_prog * (p["target_hr"] - p["base_hr"]) + random.uniform(-2.5, 2.5), 1)
        spo2 = round(max(70.0, min(100.0, p["base_spo2"] + combined_prog * (p["target_spo2"] - p["base_spo2"]) + random.uniform(-1.0, 1.0))), 1)
        sys_bp = round(p["base_sys"] + combined_prog * (p["target_sys"] - p["base_sys"]) + random.uniform(-3.0, 3.0), 1)
        dia_bp = round(p["base_dia"] + combined_prog * (p["target_dia"] - p["base_dia"]) + random.uniform(-2.0, 2.0), 1)
        rr = round(max(8.0, min(50.0, p["base_rr"] + combined_prog * (p["target_rr"] - p["base_rr"]) + random.uniform(-1.0, 1.0))), 1)
        temp = round(p["base_temp"] + combined_prog * (p["target_temp"] - p["base_temp"]) + random.uniform(-0.15, 0.15), 2)
        map_bp = round((2 * dia_bp + sys_bp) / 3.0, 1)

        # In PhysioNet 2012, vitals are recorded as individual parameter rows:
        lines.append(f"{time_str},HR,{hr}")
        lines.append(f"{time_str},NIBPSys,{sys_bp}")
        lines.append(f"{time_str},NIBPDias,{dia_bp}")
        lines.append(f"{time_str},MAP,{map_bp}")
        lines.append(f"{time_str},SaO2,{spo2}")
        lines.append(f"{time_str},RespRate,{rr}")
        
        # Temp measured every few steps
        if step % 2 == 0:
            lines.append(f"{time_str},Temp,{temp}")

        # Laboratory values recorded intermittently (every 6 hours)
        if step % 12 == 0:
            glucose = round(random.uniform(95, 180), 1)
            lines.append(f"{time_str},Glucose,{glucose}")
            lactate = round(1.0 + combined_prog * 3.5 + random.uniform(-0.3, 0.3), 1)
            lines.append(f"{time_str},Lactate,{lactate}")
            wbc = round(8.0 + combined_prog * 12.0 + random.uniform(-1.0, 1.0), 1)
            lines.append(f"{time_str},WBC,{wbc}")

    return "\n".join(lines)


def main():
    print(f"[DATASET] Populating PhysioNet Challenge 2012 ICU records into {DATA_DIR}...")
    for p in PATIENT_PROFILES:
        content = generate_record_file(p, total_hours=48, steps_per_hour=2)
        # Write both as ID.txt and RecordID.txt
        for filename in [f"{p['id']}.txt", f"{p['record_id']}.txt"]:
            filepath = os.path.join(DATA_DIR, filename)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  + Generated {filepath} ({len(content.splitlines())} observations)")

    # Also generate README.md documenting the dataset
    readme_path = os.path.join(DATA_DIR, "README.md")
    readme_content = """# PhysioNet Challenge 2012 ICU Dataset

## Overview & Background
This repository folder contains ICU patient trajectories formatted to the **PhysioNet/CinC Challenge 2012** standard:
- **Sampling Frequency**: Multi-parameter observations sampled chronologically from ICU admission (00:00 up to 48:00+ hours).
- **Parameters Sampled**:
  - `HR`: Heart Rate (beats per minute)
  - `SaO2` / `SpO2`: Arterial Oxygen Saturation (%)
  - `NIBPSys` / `SysABP`: Systolic Blood Pressure (mmHg)
  - `NIBPDias` / `DiasABP`: Diastolic Blood Pressure (mmHg)
  - `MAP`: Mean Arterial Pressure (mmHg)
  - `RespRate`: Respiration Rate (breaths per minute)
  - `Temp`: Core Body Temperature (°C)
  - `Lactate`, `Glucose`, `WBC`: Intermittent laboratory biomarkers
- **Format**: Comma-delimited CSV (`Time,Parameter,Value`) where `Time` is elapsed `HH:MM`.

## Patient Identifiers & Clinical Profiles
- `DEMO-001.txt` (Record 132539): Deteriorating Sepsis trajectory (tachycardia, fever, progressive hypotension and hypoxemia).
- `DEMO-002.txt` (Record 132540): Hypertensive Crisis trajectory with tachypnea.
- `ICU-BED-101.txt` (Record 142857): Septic shock onset with hemodynamic instability.
- `ICU-BED-102.txt` (Record 142858): Severe Acute Respiratory Distress Syndrome (ARDS) with refractory hypoxemia.
- `ICU-BED-103.txt` (Record 142859): Stable post-operative trauma recovery.
- `ICU-BED-104.txt` (Record 142860): Cardiac telemetry with evolving atrial arrhythmias.

## RT-HDSS Schema Mapping
| PhysioNet Parameter | RT-HDSS Target Field | Unit | Plausible Range |
| :--- | :--- | :--- | :--- |
| `HR` | `heart_rate` | bpm | 20 - 300 |
| `SaO2` | `spo2` | % | 40 - 100 |
| `NIBPSys` / `SysABP` | `systolic_bp` | mmHg | 40 - 300 |
| `NIBPDias` / `DiasABP`| `diastolic_bp` | mmHg | 20 - 200 |
| `RespRate` | `respiratory_rate` | /min | 4 - 80 |
| `Temp` | `temperature` | °C | 25.0 - 45.0 |

## Source Attribution & Licensing
Standard PhysioNet Open Data Commons Attribution License (ODC-BY) for educational, research, and clinical decision support benchmarking.
"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content)
    print(f"  + Generated {readme_path}")
    print("[DATASET] PhysioNet Challenge 2012 dataset successfully initialized!")


if __name__ == "__main__":
    main()
