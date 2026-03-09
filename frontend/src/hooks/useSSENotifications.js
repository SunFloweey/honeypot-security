import { useEffect, useState, useCallback, useRef } from 'react';
import { useAdminAuth } from './useAdminAuth';
import CONFIG from '../config';

/**
 * Hook per gestire notifiche real-time via SSE.
 */
export const useSSENotifications = (onLogBatch, onSSEStatusChange) => {
    const [notification, setNotification] = useState(null);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
    const [sseStatus, setSseStatus] = useState('connecting');
    const { getToken } = useAdminAuth();

    const onLogBatchRef = useRef(onLogBatch);
    const onSSEStatusChangeRef = useRef(onSSEStatusChange);
    const lastHeartbeatRef = useRef(Date.now());
    const eventSourceRef = useRef(null);
    const isConnectingRef = useRef(false);
    const heartbeatTimerRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    useEffect(() => {
        onLogBatchRef.current = onLogBatch;
        onSSEStatusChangeRef.current = onSSEStatusChange;
    }, [onLogBatch, onSSEStatusChange]);

    const isAudioUnlockedRef = useRef(isAudioUnlocked);
    useEffect(() => {
        isAudioUnlockedRef.current = isAudioUnlocked;
    }, [isAudioUnlocked]);

    const unlockAudio = useCallback(() => {
        setIsAudioUnlocked(true);
        console.log('🔊 [Audio] Monitoring alerts unlocked');
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhAAQACABAAAABkYXRhAgAAAAEA');
        audio.play().catch(() => { });
    }, []);

    const showNotification = useCallback((data) => {
        setNotification(data);
        if (isAudioUnlockedRef.current) {
            new Audio('/notifica.mp3').play().catch(() => { });
        }
    }, []); // Stable now

    const connect = useCallback(async () => {
        if (isConnectingRef.current) return;
        isConnectingRef.current = true;

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        const token = getToken();
        if (!token) {
            isConnectingRef.current = false;
            return;
        }

        try {
            console.log(`📡 SSE connecting to ${CONFIG.API_BASE_URL}...`);
            const headers = localStorage.getItem('saasToken')
                ? { 'Authorization': `Bearer ${token}` }
                : { 'x-admin-token': token };

            const response = await fetch(`${CONFIG.API_BASE_URL}/api/stream-ticket`, { headers });
            const { ticket } = await response.json();

            if (!ticket) throw new Error('No ticket');

            const es = new EventSource(`${CONFIG.API_BASE_URL}/api/stream?token=${ticket}`);
            eventSourceRef.current = es;

            es.onopen = () => {
                setSseStatus('connected');
                onSSEStatusChangeRef.current?.(true);
                lastHeartbeatRef.current = Date.now();
                isConnectingRef.current = false;
            };

            es.onmessage = (event) => {
                lastHeartbeatRef.current = Date.now();
                if (event.data.includes(': heartbeat')) return;

                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'CRITICAL_RISK' || data.type === 'THREAT_SYNTHESIS') {
                        showNotification(data);
                    } else {
                        // Forward LOG_BATCH, TERMINAL_ACTIVITY
                        onLogBatchRef.current?.(data);
                    }
                } catch (e) { }
            };

            es.onerror = () => {
                isConnectingRef.current = false;
                setSseStatus('error');
                onSSEStatusChangeRef.current?.(false);
                setTimeout(connect, 10000);
            };

        } catch (error) {
            isConnectingRef.current = false;
            setTimeout(connect, 10000);
        }
    }, [getToken, showNotification]);

    useEffect(() => {
        connect();
        return () => {
            if (eventSourceRef.current) eventSourceRef.current.close();
            clearTimeout(reconnectTimeoutRef.current);
            clearInterval(heartbeatTimerRef.current);
        };
    }, [connect]);

    return { notification, setNotification, isAudioUnlocked, unlockAudio, sseStatus };
};
