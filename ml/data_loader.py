"""
PhysioNet / Clinical Data Loader for RT-HDSS
Provides unified loading interface for historical ICU records and synthetic fixtures.
"""

import os
from typing import Dict, List, Any, Optional
import numpy as np


class ClinicalDataLoader:
    REQUIRED_FEATURES = [
        "heart_rate",
        "spo2",
        "systolic_bp",
        "diastolic_bp",
        "respiratory_rate",
        "temperature"
    ]

    def __init__(self, data_dir: str = "data/physionet_2012"):
        self.data_dir = data_dir

    def is_dataset_available(self) -> bool:
        """Check if physical PhysioNet dataset files exist in data_dir."""
        return os.path.exists(self.data_dir) and len(os.listdir(self.data_dir)) > 0

    def load_patient_records(self, patient_file: str) -> List[Dict[str, Any]]:
        """Parse raw PhysioNet record file or return empty if missing."""
        if not os.path.exists(patient_file):
            return []
        records = []
        # PhysioNet 2012 format: Time, Parameter, Value
        with open(patient_file, "r") as f:
            for line in f:
                parts = line.strip().split(",")
                if len(parts) == 3:
                    time_str, param, val = parts
                    records.append({"time": time_str, "param": param, "value": val})
        return records

    def get_feature_names(self) -> List[str]:
        return list(self.REQUIRED_FEATURES)
