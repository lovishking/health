from fastapi import APIRouter
from app.api.v1.endpoints import patients, readings, alerts, websocket, health, users, replay

api_router = APIRouter()

api_router.include_router(health.router, prefix="", tags=["Health"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(readings.router, prefix="", tags=["Readings"])
api_router.include_router(alerts.router, prefix="", tags=["Alerts"])
api_router.include_router(replay.router, prefix="/replay", tags=["Replay"])
api_router.include_router(websocket.router, prefix="", tags=["WebSocket"])
