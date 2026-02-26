import { useRef, useEffect, useCallback } from 'react';
import { WS_BASE } from '../config';

export function useWebSocket(roomId, token, onMessage) {
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);

    const connect = useCallback(() => {
        if (!roomId || !token) return;
        const url = `${WS_BASE}/ws/${roomId}?token=${token}`;
        const ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('[WS] Connected to room', roomId);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (e) {
                console.error('[WS] Parse error', e);
            }
        };

        ws.onerror = (err) => console.error('[WS] Error', err);

        ws.onclose = (e) => {
            console.log('[WS] Closed', e.code);
            if (e.code !== 4001) {
                reconnectTimer.current = setTimeout(connect, 3000);
            }
        };

        wsRef.current = ws;
    }, [roomId, token, onMessage]);

    useEffect(() => {
        connect();
        return () => {
            clearTimeout(reconnectTimer.current);
            wsRef.current?.close();
        };
    }, [connect]);

    return wsRef;
}
