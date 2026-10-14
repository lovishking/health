"""
Replay Engine for RT-HDSS
Replays historical ICU observations or labeled synthetic data streams
into the FastAPI ingestion pipeline with configurable playback speeds.
"""

import sys
import time
import argparse
import requests
from typing import List, Dict, Any, Optional
from simulator.synthetic_generator import generate_synthetic_stream


class ReplayEngine:
    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        delay_seconds: float = 1.0,
        patient_id: str = "DEMO-001",
        scenario: str = "deteriorating",
        num_records: int = 30
    ):
        self.base_url = base_url.rstrip("/")
        self.delay_seconds = delay_seconds
        self.patient_id = patient_id
        self.scenario = scenario
        self.num_records = num_records

        self.is_running = False
        self.is_paused = False
        self.sent_count = 0
        self.error_count = 0
        self.skipped_count = 0

    def start_replay(self, records: Optional[List[Dict[str, Any]]] = None):
        """Execute stream replay to the FastAPI ingestion endpoint."""
        if records is None:
            print(f"[REPLAY] Generating synthetic stream for patient {self.patient_id} ({self.scenario})...")
            records = generate_synthetic_stream(
                patient_id=self.patient_id,
                scenario=self.scenario,
                num_steps=self.num_records
            )

        self.is_running = True
        self.sent_count = 0
        self.error_count = 0
        self.skipped_count = 0

        endpoint = f"{self.base_url}/api/v1/patients/{self.patient_id}/readings"
        print(f"[REPLAY] Beginning stream to {endpoint} (Delay: {self.delay_seconds}s)")

        for idx, item in enumerate(records):
            if not self.is_running:
                print("[REPLAY] Stream aborted by stop command.")
                break

            while self.is_paused:
                time.sleep(0.5)

            try:
                resp = requests.post(endpoint, json=item, timeout=5.0)
                if resp.status_code in [200, 201]:
                    self.sent_count += 1
                    data = resp.json()
                    print(
                        f"[{idx+1}/{len(records)}] Sent -> HR: {item.get('heart_rate')} bpm | "
                        f"SpO2: {item.get('spo2')}% | BP: {item.get('systolic_bp')}/{item.get('diastolic_bp')} | "
                        f"Resp: {item.get('respiratory_rate')}/min | Status: {resp.status_code}"
                    )
                else:
                    self.error_count += 1
                    print(f"[{idx+1}/{len(records)}] Ingestion failed (Status: {resp.status_code}): {resp.text}")
            except Exception as e:
                self.error_count += 1
                print(f"[{idx+1}/{len(records)}] Connection error: {e}")

            time.sleep(self.delay_seconds)

        self.is_running = False
        print("\n=== REPLAY SUMMARY ===")
        print(f"Total processed: {len(records)}")
        print(f"Successfully sent: {self.sent_count}")
        print(f"Errors: {self.error_count}")
        print(f"Skipped: {self.skipped_count}")


def main():
    parser = argparse.ArgumentParser(description="RT-HDSS Physiological Replay Engine")
    parser.add_argument("--url", default="http://localhost:8000", help="FastAPI Base URL")
    parser.add_argument("--patient", default="DEMO-001", help="Target patient display ID")
    parser.add_argument("--scenario", default="deteriorating", choices=["stable", "deteriorating", "critical_override"], help="Simulation scenario")
    parser.add_argument("--speed", type=float, default=1.0, help="Interval delay in seconds between events")
    parser.add_argument("--records", type=int, default=25, help="Number of reading steps to transmit")

    args = parser.parse_args()
    engine = ReplayEngine(
        base_url=args.url,
        delay_seconds=args.speed,
        patient_id=args.patient,
        scenario=args.scenario,
        num_records=args.records
    )
    engine.start_replay()


if __name__ == "__main__":
    main()
