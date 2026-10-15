"""
Replay Engine for RT-HDSS
Replays historical ICU observations from PhysioNet Challenge 2012 or labeled synthetic data streams
into the FastAPI ingestion pipeline with configurable playback speeds.
"""

import sys
import os
import time
import argparse
from datetime import datetime, timezone
import requests
from typing import List, Dict, Any, Optional

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ml.data_loader import ClinicalDataLoader
from simulator.synthetic_generator import generate_synthetic_stream


class ReplayEngine:
    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        delay_seconds: float = 1.0,
        patient_id: str = "DEMO-001",
        source_type: str = "dataset",  # "dataset" (PhysioNet 2012) or "synthetic"
        scenario: str = "deteriorating",
        num_records: int = 50,
        loop: bool = True
    ):
        self.base_url = base_url.rstrip("/")
        self.delay_seconds = delay_seconds
        self.patient_id = patient_id
        self.source_type = source_type
        self.scenario = scenario
        self.num_records = num_records
        self.loop = loop

        self.is_running = False
        self.is_paused = False
        self.sent_count = 0
        self.error_count = 0
        self.skipped_count = 0
        self.current_step = 0
        self.data_loader = ClinicalDataLoader()

    def load_stream_records(self) -> List[Dict[str, Any]]:
        """Load observations from PhysioNet Challenge 2012 dataset or generate synthetic."""
        if self.source_type == "dataset" and self.data_loader.is_dataset_available():
            records = self.data_loader.load_chronological_vital_readings(self.patient_id)
            if records:
                print(f"[REPLAY] Loaded {len(records)} PhysioNet 2012 ICU records for patient {self.patient_id}")
                return records
            else:
                print(f"[REPLAY] Patient {self.patient_id} not found in PhysioNet 2012 dataset, falling back to synthetic generator")

        print(f"[REPLAY] Generating synthetic stream for patient {self.patient_id} ({self.scenario})...")
        return generate_synthetic_stream(
            patient_id=self.patient_id,
            scenario=self.scenario,
            num_steps=self.num_records
        )

    def start_replay(self, records: Optional[List[Dict[str, Any]]] = None):
        """Execute stream replay to the FastAPI ingestion endpoint."""
        if records is None:
            records = self.load_stream_records()
            if self.num_records and self.num_records > 0:
                records = records[:self.num_records]

        self.is_running = True
        self.sent_count = 0
        self.error_count = 0
        self.skipped_count = 0
        self.current_step = 0

        endpoint = f"{self.base_url}/api/v1/patients/{self.patient_id}/readings"
        print(f"[REPLAY] Beginning stream to {endpoint} (Delay: {self.delay_seconds}s | Source: {self.source_type} | Records: {len(records)})", flush=True)

        while self.is_running:
            for idx, item in enumerate(records):
                if not self.is_running:
                    print("[REPLAY] Stream aborted by stop command.")
                    break

                while self.is_paused:
                    time.sleep(0.5)

                self.current_step += 1
                # Update event timestamp to present time for live streaming while preserving original record info
                reading_payload = dict(item)
                now_iso = datetime.now(timezone.utc).isoformat()
                reading_payload["event_timestamp"] = now_iso
                reading_payload["source_event_id"] = f"{item.get('source', 'stream')}-{self.patient_id}-{self.current_step}-{int(time.time() * 1000)}"

                try:
                    resp = requests.post(endpoint, json=reading_payload, timeout=5.0)
                    if resp.status_code in [200, 201]:
                        self.sent_count += 1
                        print(
                            f"[{self.sent_count}] Replay -> HR: {reading_payload.get('heart_rate')} bpm | "
                            f"SpO2: {reading_payload.get('spo2')}% | BP: {reading_payload.get('systolic_bp')}/{reading_payload.get('diastolic_bp')} | "
                            f"Source: {reading_payload.get('source')} | Status: {resp.status_code}"
                        )
                    else:
                        self.error_count += 1
                        print(f"[{self.sent_count}] Ingestion failed ({resp.status_code}): {resp.text}")
                except Exception as e:
                    self.error_count += 1
                    print(f"[{self.sent_count}] Connection error: {e}")

                time.sleep(self.delay_seconds)

            if not self.loop or not self.is_running:
                break
            print(f"[REPLAY] Completed cycle of {len(records)} records. Looping seamlessly...")

        self.is_running = False
        print("\n=== REPLAY SUMMARY ===")
        print(f"Total sent: {self.sent_count}")
        print(f"Errors: {self.error_count}")
        print(f"Skipped: {self.skipped_count}")


def main():
    parser = argparse.ArgumentParser(description="RT-HDSS Physiological Replay Engine")
    parser.add_argument("--url", default="http://localhost:8000", help="FastAPI Base URL")
    parser.add_argument("--patient", default="DEMO-001", help="Target patient display ID")
    parser.add_argument("--source", default="dataset", choices=["dataset", "synthetic"], help="Data source")
    parser.add_argument("--scenario", default="deteriorating", choices=["stable", "deteriorating", "critical_override"], help="Simulation scenario (if synthetic)")
    parser.add_argument("--speed", type=float, default=1.0, help="Interval delay in seconds between events")
    parser.add_argument("--records", type=int, default=50, help="Number of reading steps to transmit")
    parser.add_argument("--no-loop", action="store_true", help="Do not loop after completing dataset")

    args = parser.parse_args()
    engine = ReplayEngine(
        base_url=args.url,
        delay_seconds=args.speed,
        patient_id=args.patient,
        source_type=args.source,
        scenario=args.scenario,
        num_records=args.records,
        loop=not args.no_loop
    )
    engine.start_replay()


if __name__ == "__main__":
    main()
