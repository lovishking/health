from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.realtime.connection_manager import ws_manager

router = APIRouter()


@router.websocket("/ws/patients/{patient_id}")
async def websocket_patient_endpoint(websocket: WebSocket, patient_id: str):
    """Real-time WebSocket endpoint streaming updates for a specific patient."""
    await ws_manager.connect(websocket, patient_id)
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connection_established",
            "patient_id": patient_id,
            "message": f"Subscribed to live physiological stream for patient {patient_id}"
        })
        while True:
            # Keep connection open and accept ping/pong or client messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, patient_id)
    except Exception:
        ws_manager.disconnect(websocket, patient_id)


@router.websocket("/ws/live")
async def websocket_global_endpoint(websocket: WebSocket):
    """Global WebSocket endpoint streaming live updates across all monitored patients."""
    await ws_manager.connect_global(websocket)
    try:
        await websocket.send_json({
            "type": "global_connection_established",
            "message": "Connected to global real-time patient broadcast"
        })
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_global(websocket)
    except Exception:
        ws_manager.disconnect_global(websocket)
