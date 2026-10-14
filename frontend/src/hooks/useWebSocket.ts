import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketEvent } from '../types';

export function useWebSocket(patientId?: string, onEvent?: (event: WebSocketEvent) => void) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<WebSocketEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    const wsUrl = patientId
      ? `ws://localhost:8000/api/v1/ws/patients/${patientId}`
      : `ws://localhost:8000/api/v1/ws/live`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        // Start keepalive ping
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 15000);
        (ws as any)._pingInterval = pingInterval;
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const parsed: WebSocketEvent = JSON.parse(event.data);
          setLastMessage(parsed);
          if (onEventRef.current) {
            onEventRef.current(parsed);
          }
        } catch (err) {
          // Ignore non-json control messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if ((ws as any)._pingInterval) {
          clearInterval((ws as any)._pingInterval);
        }
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch (e) {
      setIsConnected(false);
    }
  }, [patientId]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        if ((wsRef.current as any)._pingInterval) {
          clearInterval((wsRef.current as any)._pingInterval);
        }
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, lastMessage };
}
