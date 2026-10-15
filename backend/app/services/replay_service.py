"""
Physiological Replay Service for RT-HDSS
Streams historical ICU datasets (PhysioNet Challenge 2012) in real time
into the clinical assessment pipeline and broadcasts to connected clinicians.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from app.db.session import SessionLocal
from app.services.patient_service import PatientService
from app.services.reading_service import ReadingService
from app.services.assessment_service import AssessmentService
from app.services.alert_service import AlertService
from app.realtime.connection_manager import ws_manager
from app.schemas.reading import VitalReadingCreate
from ml.data_loader import ClinicalDataLoader
from simulator.synthetic_generator import generate_synthetic_stream

logger = logging.getLogger(__name__)


class ReplayService:
    def __init__(self):
        self.is_running: bool = False
        self.is_paused: bool = False
        self.patient_id: str = "DEMO-001"
        self.source: str = "physionet_2012"
        self.speed: float = 1.0  # seconds between readings
        self.loop: bool = True
        self.sent_count: int = 0
        self.current_step: int = 0
        self.total_records: int = 0
        self.last_reading: Optional[Dict[str, Any]] = None
        self._task: Optional[asyncio.Task] = None
        self._loader = ClinicalDataLoader()

    def list_datasets(self) -> Dict[str, Any]:
        """List available datasets and patient records."""
        patients = self._loader.list_available_patients()
        return {
            "dataset_name": "PhysioNet Challenge 2012 (In-hospital Mortality ICU)",
            "is_available": self._loader.is_dataset_available(),
            "patient_records": patients,
            "data_directory": self._loader.data_dir
        }

    def get_status(self) -> Dict[str, Any]:
        """Return the current replay status."""
        return {
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "patient_id": self.patient_id,
            "source": self.source,
            "speed": self.speed,
            "sent_count": self.sent_count,
            "current_step": self.current_step,
            "total_records": self.total_records,
            "last_reading": self.last_reading
        }

    async def start(
        self,
        patient_id: str = "DEMO-001",
        speed: float = 1.0,
        source: str = "physionet_2012",
        loop: bool = True
    ) -> Dict[str, Any]:
        """Start or restart real-time stream for the specified patient."""
        # Cancel any existing running task
        if self._task and not self._task.done():
            self.is_running = False
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        self.patient_id = patient_id
        self.speed = max(0.2, float(speed))
        self.source = source
        self.loop = loop
        self.is_running = True
        self.is_paused = False
        self.sent_count = 0
        self.current_step = 0

        self._task = asyncio.create_task(self._run_replay_loop())
        logger.info(f"[REPLAY_SERVICE] Started stream for {self.patient_id} (speed: {self.speed}s, source: {self.source})")
        return self.get_status()

    def pause(self) -> Dict[str, Any]:
        """Pause the ongoing replay stream."""
        if self.is_running:
            self.is_paused = True
        return self.get_status()

    def resume(self) -> Dict[str, Any]:
        """Resume paused replay stream."""
        if self.is_running:
            self.is_paused = False
        return self.get_status()

    def stop(self) -> Dict[str, Any]:
        """Stop replay stream completely."""
        self.is_running = False
        self.is_paused = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("[REPLAY_SERVICE] Stopped stream")
        return self.get_status()

    async def _run_replay_loop(self):
        """Internal asynchronous replay worker."""
        # 1. Load patient observations from PhysioNet dataset or synthetic fallback
        records = []
        if self.source == "physionet_2012" and self._loader.is_dataset_available():
            records = self._loader.load_chronological_vital_readings(self.patient_id)

        if not records:
            # Fallback to labeled synthetic progression
            logger.info(f"[REPLAY_SERVICE] Dataset missing or empty for {self.patient_id}, falling back to synthetic generator")
            self.source = "synthetic_sim"
            records = generate_synthetic_stream(
                patient_id=self.patient_id,
                scenario="deteriorating",
                num_steps=60
            )

        self.total_records = len(records)
        record_idx = 0

        try:
            while self.is_running:
                while self.is_paused:
                    await asyncio.sleep(0.5)
                    if not self.is_running:
                        return

                if record_idx >= len(records):
                    if self.loop:
                        record_idx = 0
                        logger.info(f"[REPLAY_SERVICE] Seamlessly looping dataset for {self.patient_id}")
                    else:
                        break

                raw_record = records[record_idx]
                self.current_step += 1
                record_idx += 1

                # Construct live reading with current UTC timestamp
                now_utc = datetime.now(timezone.utc)
                reading_in = VitalReadingCreate(
                    patient_id=self.patient_id,
                    source=raw_record.get("source", self.source),
                    source_event_id=f"replay-{self.patient_id}-{self.current_step}-{int(now_utc.timestamp() * 1000)}",
                    event_timestamp=now_utc,
                    heart_rate=raw_record.get("heart_rate"),
                    spo2=raw_record.get("spo2"),
                    systolic_bp=raw_record.get("systolic_bp"),
                    diastolic_bp=raw_record.get("diastolic_bp"),
                    respiratory_rate=raw_record.get("respiratory_rate"),
                    temperature=raw_record.get("temperature"),
                )

                # Ingest into DB & publish assessment
                db = SessionLocal()
                try:
                    patient = PatientService.get_or_create(db, display_id=self.patient_id)
                    reading, is_new = ReadingService.ingest_reading(db, patient_id=patient.id, reading_in=reading_in)
                    if is_new:
                        prediction = AssessmentService.evaluate_reading(db, reading)
                        alert = AlertService.process_prediction_for_alerts(db, prediction)

                        reading_dict = {
                            "id": reading.id,
                            "patient_id": patient.display_id,
                            "source": reading.source,
                            "event_timestamp": reading.event_timestamp.isoformat(),
                            "heart_rate": reading.heart_rate,
                            "spo2": reading.spo2,
                            "systolic_bp": reading.systolic_bp,
                            "diastolic_bp": reading.diastolic_bp,
                            "respiratory_rate": reading.respiratory_rate,
                            "temperature": reading.temperature,
                            "quality_flags": reading.quality_flags,
                            "risk_tier": prediction.final_tier,
                            "decision_source": prediction.decision_source,
                            "alert_created": alert is not None
                        }

                        # Broadcast to active WebSocket connections
                        await ws_manager.broadcast_patient_event(patient.display_id, "reading_update", reading_dict)

                        if alert:
                            alert_dict = {
                                "id": alert.id,
                                "patient_id": patient.display_id,
                                "severity": alert.severity,
                                "message": alert.message,
                                "status": alert.status,
                                "created_at": alert.created_at.isoformat()
                            }
                            await ws_manager.broadcast_patient_event(patient.display_id, "alert_triggered", alert_dict)

                        self.sent_count += 1
                        self.last_reading = reading_dict
                except Exception as e:
                    logger.error(f"[REPLAY_SERVICE] Error processing step {self.current_step}: {e}", exc_info=True)
                finally:
                    db.close()

                # Sleep interval for configured playback speed
                await asyncio.sleep(self.speed)

        except asyncio.CancelledError:
            logger.info("[REPLAY_SERVICE] Replay task cancelled")
        finally:
            self.is_running = False


# Global singleton instance
replay_service = ReplayService()
