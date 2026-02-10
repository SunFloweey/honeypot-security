import { useEffect, useState, useCallback } from 'react';
import { useAdminAuth } from './useAdminAuth';

/**
 * Hook per gestire notifiche real-time via SSE
 * Gestisce eventi CRITICAL_RISK e LOG_BATCH
 */
export const useSSENotifications = (onLogBatch, onSSEStatusChange) => {
    const [notification, setNotification] = useState(null);
    const { getToken } = useAdminAuth();

    const showNotification = useCallback((data) => {
        setNotification(data);

        // Audio alert per eventi critici
        const audio = new Audio(
            'https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3'
        );
        audio.play().catch(e => console.log('Audio play failed', e));
    }, []);

    useEffect(() => {
        const token = getToken();
        if (!token) return;

        const eventSource = new EventSource(`/api/stream?token=${token}`);

        eventSource.onopen = () => {
            onSSEStatusChange?.(true);
            console.log('✅ SSE connesso - polling ridotto');
        };

        eventSource.onerror = () => {
            onSSEStatusChange?.(false);
            console.warn('⚠️ SSE disconnesso - polling attivo');
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'CRITICAL_RISK') {
                    showNotification(data);
                } else if (data.type === 'LOG_BATCH') {
                    console.log('🔄 SSE: Received LOG_BATCH, refreshing data...');
                    onLogBatch?.();
                }
            } catch (e) {
                console.error("SSE Parse Error", e);
            }
        };

        return () => {
            onSSEStatusChange?.(false);
            eventSource.close();
        };
    }, [getToken, onLogBatch, onSSEStatusChange, showNotification]);

    return { notification, setNotification };
};