"""
Replay API Endpoints for RT-HDSS
Allows clinicians and frontend dashboards to manage real-time dataset replay streams.
"""

from typing import Optional
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.services.replay_service import replay_service

router = APIRouter()


class ReplayStartRequest(BaseModel):
    patient_id: str = Field(default="DEMO-001", description="Patient display ID")
    speed: float = Field(default=1.0, ge=0.2, le=10.0, description="Interval in seconds between observations")
    source: str = Field(default="physionet_2012", description="Dataset source name: physionet_2012 or synthetic_sim")
    loop: bool = Field(default=True, description="Whether to loop continuously when dataset ends")


@router.get("/status", status_code=status.HTTP_200_OK)
def get_replay_status():
    """Get active replay status, statistics, and latest replayed observation."""
    return replay_service.get_status()


@router.get("/datasets", status_code=status.HTTP_200_OK)
def get_available_datasets():
    """List available clinical datasets and historical patient files."""
    return replay_service.list_datasets()


@router.post("/start", status_code=status.HTTP_200_OK)
async def start_replay_stream(req: ReplayStartRequest):
    """Start or switch real-time streaming from historical ICU dataset."""
    result = await replay_service.start(
        patient_id=req.patient_id,
        speed=req.speed,
        source=req.source,
        loop=req.loop
    )
    return result


@router.post("/pause", status_code=status.HTTP_200_OK)
def pause_replay_stream():
    """Pause the active stream."""
    return replay_service.pause()


@router.post("/resume", status_code=status.HTTP_200_OK)
def resume_replay_stream():
    """Resume the paused stream."""
    return replay_service.resume()


@router.post("/stop", status_code=status.HTTP_200_OK)
def stop_replay_stream():
    """Stop the stream."""
    return replay_service.stop()
