"""
PhysioNet / Clinical Data Loader for RT-HDSS
Provides unified loading interface for historical ICU records (PhysioNet Challenge 2012)
and synthetic fixtures. Parses multi-parameter chronological records into standard schema.
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional


class ClinicalDataLoader:
    PARAM_MAPPING = {
        "HR": "heart_rate",
        "SaO2": "spo2",
        "SpO2": "spo2",
        "SysABP": "systolic_bp",
        "NIBPSys": "systolic_bp",
        "DiasABP": "diastolic_bp",
        "NIBPDias": "diastolic_bp",
        "RespRate": "respiratory_rate",
        "Temp": "temperature",
    }

    REQUIRED_FEATURES = [
        "heart_rate",
        "spo2",
        "systolic_bp",
        "diastolic_bp",
        "respiratory_rate",
        "temperature"
    ]

    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            # Resolve relative to project root or backend
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            candidates = [
                os.path.join(base_dir, "data", "physionet_2012"),
                os.path.abspath("data/physionet_2012"),
            ]
            self.data_dir = candidates[0]
            for c in candidates:
                if os.path.exists(c) and len([f for f in os.listdir(c) if f.endswith(".txt")]) > 0:
                    self.data_dir = c
                    break
        else:
            self.data_dir = data_dir

    def is_dataset_available(self) -> bool:
        """Check if physical PhysioNet dataset files exist in data_dir."""
        return os.path.exists(self.data_dir) and len([f for f in os.listdir(self.data_dir) if f.endswith(".txt")]) > 0

    def list_available_patients(self) -> List[str]:
        """List patient IDs found in the dataset directory."""
        if not os.path.exists(self.data_dir):
            return []
        files = os.listdir(self.data_dir)
        patient_ids = []
        for f in files:
            if f.endswith(".txt"):
                patient_ids.append(f[:-4])
        return sorted(list(set(patient_ids)))

    def load_patient_records(self, patient_file: str) -> List[Dict[str, Any]]:
        """Parse raw PhysioNet record file or return empty if missing."""
        if not os.path.isabs(patient_file):
            patient_file = os.path.join(self.data_dir, patient_file)
        if not os.path.exists(patient_file):
            return []
        records = []
        with open(patient_file, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(",")
                if len(parts) == 3:
                    time_str, param, val = parts
                    records.append({"time": time_str, "param": param, "value": val})
        return records

    def load_chronological_vital_readings(
        self,
        patient_id: str,
        start_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Load and aggregate raw PhysioNet records into chronological clinical observation steps.
        Maps PhysioNet 2012 parameters into RT-HDSS standard schema:
        - HR -> heart_rate
        - SaO2 -> spo2
        - NIBPSys/SysABP -> systolic_bp
        - NIBPDias/DiasABP -> diastolic_bp
        - RespRate -> respiratory_rate
        - Temp -> temperature
        """
        filename = f"{patient_id}.txt" if not patient_id.endswith(".txt") else patient_id
        filepath = os.path.join(self.data_dir, filename)
        if not os.path.exists(filepath):
            # Try matching display ID or numeric record ID
            alt_candidates = [f for f in os.listdir(self.data_dir) if f.startswith(patient_id)]
            if alt_candidates:
                filepath = os.path.join(self.data_dir, alt_candidates[0])
            else:
                return []

        raw_records = self.load_patient_records(filepath)
        if not raw_records:
            return []

        # Group observations by timestamp HH:MM
        time_grouped: Dict[str, Dict[str, Any]] = {}
        for r in raw_records:
            t = r["time"]
            if t == "00:00" and r["param"] in ["RecordID", "Age", "Gender", "Height", "Weight"]:
                continue
            if t not in time_grouped:
                time_grouped[t] = {}
            time_grouped[t][r["param"]] = r["value"]

        if start_time is None:
            start_time = datetime.now(timezone.utc) - timedelta(hours=2)

        vital_steps: List[Dict[str, Any]] = []
        last_known_vitals = {
            "heart_rate": 78.0,
            "spo2": 98.0,
            "systolic_bp": 120.0,
            "diastolic_bp": 80.0,
            "respiratory_rate": 16.0,
            "temperature": 37.0,
        }

        for idx, (t_str, params) in enumerate(time_grouped.items()):
            # Parse elapsed minutes from HH:MM
            try:
                parts = t_str.split(":")
                elapsed_mins = int(parts[0]) * 60 + int(parts[1])
            except Exception:
                elapsed_mins = idx * 30

            obs_time = start_time + timedelta(minutes=elapsed_mins)

            # Update last known with any present vitals
            for raw_param, val in params.items():
                target_field = self.PARAM_MAPPING.get(raw_param)
                if target_field:
                    try:
                        last_known_vitals[target_field] = float(val)
                    except ValueError:
                        pass

            reading_item = {
                "source": "physionet_2012",
                "source_event_id": f"physionet-{patient_id}-{idx}-{t_str.replace(':', '')}",
                "original_record_time": t_str,
                "event_timestamp": obs_time.isoformat(),
                "heart_rate": last_known_vitals["heart_rate"],
                "spo2": last_known_vitals["spo2"],
                "systolic_bp": last_known_vitals["systolic_bp"],
                "diastolic_bp": last_known_vitals["diastolic_bp"],
                "respiratory_rate": last_known_vitals["respiratory_rate"],
                "temperature": last_known_vitals["temperature"],
            }
            vital_steps.append(reading_item)

        return vital_steps

    def get_feature_names(self) -> List[str]:
        return list(self.REQUIRED_FEATURES)
