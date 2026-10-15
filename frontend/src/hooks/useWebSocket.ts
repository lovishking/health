import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketEvent } from '../types';

export function useWebSocket(patientId?: string, onEvent?: (event: WebSocketEvent) => void) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<WebSocketEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const onEventRef = useRef(onEvent);
  const isMountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const reconnectDelayRef = useRef(1000);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current !== null) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Don't connect if unmounted or intentionally closed
    if (!isMountedRef.current || intentionalCloseRef.current) return;

    // Close existing connection cleanly before reconnecting
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.onclose = null; // prevent recursive reconnect
      wsRef.current.close();
    }
    clearPingInterval();

    const wsUrl = patientId
      ? `ws://localhost:8000/api/v1/ws/patients/${encodeURIComponent(patientId)}`
      : `ws://localhost:8000/api/v1/ws/live`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      if (isMountedRef.current) setIsConnected(false);
      return;
    }

    ws.onopen = () => {
      if (!isMountedRef.current) { ws.close(); return; }
      reconnectDelayRef.current = 1000; // reset backoff on success
      setIsConnected(true);
      // Start keepalive ping every 20s
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 20000);
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;
      if (event.data === 'pong') return;
      try {
        const parsed: WebSocketEvent = JSON.parse(event.data);
        setLastMessage(parsed);
        if (onEventRef.current) {
          onEventRef.current(parsed);
        }
      } catch {
        // Ignore non-json control messages
      }
    };

    ws.onclose = (evt) => {
      clearPingInterval();
      if (!isMountedRef.current || intentionalCloseRef.current) return;
      if (isMountedRef.current) setIsConnected(false);

      // Exponential backoff reconnect: 1s, 2s, 4s, max 10s
      const delay = Math.min(reconnectDelayRef.current, 10000);
      reconnectDelayRef.current = Math.min(delay * 2, 10000);
      clearReconnectTimeout();
      reconnectTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current && !intentionalCloseRef.current) {
          connect();
        }
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
      ws.close();
    };

    wsRef.current = ws;
  }, [patientId, clearPingInterval, clearReconnectTimeout]);

  useEffect(() => {
    isMountedRef.current = true;
    intentionalCloseRef.current = false;
    reconnectDelayRef.current = 1000;
    connect();
    return () => {
      isMountedRef.current = false;
      intentionalCloseRef.current = true;
      clearReconnectTimeout();
      clearPingInterval();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, clearReconnectTimeout, clearPingInterval]);

  return { isConnected, lastMessage };
}
