import json
from typing import Dict, List
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # Maps patient_id -> list of active WebSocket connections
        self.active_patient_connections: Dict[str, List[WebSocket]] = {}
        # Global connections (e.g. overview dashboard)
        self.active_global_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, patient_id: str):
        await websocket.accept()
        if patient_id not in self.active_patient_connections:
            self.active_patient_connections[patient_id] = []
        self.active_patient_connections[patient_id].append(websocket)

    def disconnect(self, websocket: WebSocket, patient_id: str):
        if patient_id in self.active_patient_connections:
            if websocket in self.active_patient_connections[patient_id]:
                self.active_patient_connections[patient_id].remove(websocket)
            if not self.active_patient_connections[patient_id]:
                del self.active_patient_connections[patient_id]

    async def connect_global(self, websocket: WebSocket):
        await websocket.accept()
        self.active_global_connections.append(websocket)

    def disconnect_global(self, websocket: WebSocket):
        if websocket in self.active_global_connections:
            self.active_global_connections.remove(websocket)

    async def broadcast_patient_event(self, patient_id: str, event_type: str, data: dict):
        payload = json.dumps({"type": event_type, "patient_id": patient_id, "data": data})

        # Broadcast to specific patient subscribers
        if patient_id in self.active_patient_connections:
            dead_connections = []
            for ws in self.active_patient_connections[patient_id]:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead_connections.append(ws)
            for ws in dead_connections:
                self.disconnect(ws, patient_id)

        # Broadcast to global subscribers
        dead_global = []
        for ws in self.active_global_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead_global.append(ws)
        for ws in dead_global:
            self.disconnect_global(ws)


ws_manager = ConnectionManager()
