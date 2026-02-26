import { useEffect, useState, useCallback, useRef } from 'react';
import { useAdminAuth } from './useAdminAuth';

/**
 * Hook per gestire notifiche real-time via SSE.
 * Implementa un "Atomic Lock" per prevenire cascate di riconnessione e saturazione socket.
 */
export const useSSENotifications = (onLogBatch, onSSEStatusChange) => {
    const [notification, setNotification] = useState(null);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
    const [sseStatus, setSseStatus] = useState('connecting');
    const { getToken } = useAdminAuth();

    // Riferimenti stabili per callback ed eventi
    const onLogBatchRef = useRef(onLogBatch);
    const onSSEStatusChangeRef = useRef(onSSEStatusChange);
    const isAudioUnlockedRef = useRef(isAudioUnlocked); // Ref per evitare riconnessioni su unlock audio
    const lastHeartbeatRef = useRef(Date.now());
    const notificationQueueRef = useRef([]);
    const batchTimeoutRef = useRef(null);

    // Gestione Connessione (Core Refs)
    const eventSourceRef = useRef(null);
    const isConnectingRef = useRef(false);
    const heartbeatTimerRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);

    // Sincronizzazione callback e refs
    useEffect(() => {
        onLogBatchRef.current = onLogBatch;
        onSSEStatusChangeRef.current = onSSEStatusChange;
        isAudioUnlockedRef.current = isAudioUnlocked;
    }, [onLogBatch, onSSEStatusChange, isAudioUnlocked]);

    const unlockAudio = useCallback(() => {
        setIsAudioUnlocked(true);
        console.log('🔊 [Audio] Monitoring alerts unlocked');
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhAAQACABAAAABkYXRhAgAAAAEA');
        audio.play().catch(() => { });
    }, []);

    const processNotificationQueue = useCallback(() => {
        if (notificationQueueRef.current.length === 0) return;
        const latest = notificationQueueRef.current[notificationQueueRef.current.length - 1];
        setNotification(latest);

        if (isAudioUnlockedRef.current) {
            new Audio('/notifica.mp3').play().catch(() => { });
        }

        notificationQueueRef.current = [];
        batchTimeoutRef.current = null;
    }, []);

    const showNotification = useCallback((data) => {
        notificationQueueRef.current.push(data);
        if (!batchTimeoutRef.current) {
            batchTimeoutRef.current = setTimeout(processNotificationQueue, 500);
        }
    }, [processNotificationQueue]);

    const connectRef = useRef(null);

    const handleDisconnect = useCallback(() => {
        isConnectingRef.current = false;
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        clearInterval(heartbeatTimerRef.current);

        setSseStatus('error');
        onSSEStatusChangeRef.current?.(false);

        // Riconnessione pianificata (Singleton)
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
        }, 10000);
    }, []);

    const startHeartbeatCheck = useCallback(() => {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => {
            const diff = Date.now() - lastHeartbeatRef.current;
            if (diff > 45000) {
                console.warn('🚨 SSE Heartbeat lost. Forcing reconnection...');
                connectRef.current?.();
            }
        }, 15000);
    }, []);

    const connect = useCallback(async () => {
        // 1. ATOMIC LOCK: Impedisce chiamate concorrenti
        if (isConnectingRef.current) return;
        isConnectingRef.current = true;

        // Pulizia totale degli stati precedenti
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        clearTimeout(reconnectTimeoutRef.current);
        clearInterval(heartbeatTimerRef.current);

        const token = getToken();
        if (!token) {
            isConnectingRef.current = false;
            return;
        }

        try {
            console.log("📡 Richiesta ticket SSE...");

            // Determina quale header usare per il ticket
            const headers = localStorage.getItem('saasToken')
                ? { 'Authorization': `Bearer ${token}` }
                : { 'x-admin-token': token };

            const response = await fetch('/api/stream-ticket', {
                headers
            });

            if (!response.ok) throw new Error(`Ticket HTTP error: ${response.status}`);
            const { ticket } = await response.json();
            if (!ticket) throw new Error('No ticket received');

            const es = new EventSource(`/api/stream?token=${ticket}`);
            eventSourceRef.current = es;

            es.onopen = () => {
                console.debug('✅ SSE Connected');
                setSseStatus('connected');
                onSSEStatusChangeRef.current?.(true);
                lastHeartbeatRef.current = Date.now();
                isConnectingRef.current = false; // Riapro il lock: siamo connessi

                // Avvio monitoraggio heartbeat singleton
                startHeartbeatCheck();
            };

            es.onerror = () => {
                console.warn('⚠️ SSE Error. Scheduling reconnect...');
                handleDisconnect();
            };

            es.onmessage = (event) => {
                lastHeartbeatRef.current = Date.now();
                if (event.data === ': heartbeat') return;

                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'CRITICAL_RISK') {
                        showNotification(data);
                    } else if (data.type === 'THREAT_SYNTHESIS' || data.type === 'LOG_BATCH' || data.type === 'TERMINAL_ACTIVITY') {
                        onLogBatchRef.current?.(data);
                    }
                } catch (e) {
                    console.error("SSE Parse Error", e);
                }
            };

        } catch (error) {
            console.error('❌ SSE Init Error:', error.message);
            handleDisconnect();
        }
    }, [getToken, showNotification, handleDisconnect, startHeartbeatCheck]);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    useEffect(() => {
        connect();
        return () => {
            console.log("🧹 Final Cleanup SSE...");
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            clearTimeout(reconnectTimeoutRef.current);
            clearInterval(heartbeatTimerRef.current);
            if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
            isConnectingRef.current = false;
        };
    }, [connect]);

    return { notification, setNotification, isAudioUnlocked, unlockAudio, sseStatus };
};

/*import { useEffect, useState, useCallback, useRef } from 'react';
import { useAdminAuth } from './useAdminAuth';


export const useSSENotifications = (onLogBatch, onSSEStatusChange) => {
    const [notification, setNotification] = useState(null);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
    const [sseStatus, setSseStatus] = useState('connecting');
    const { getToken } = useAdminAuth();

    // Riferimenti per le callback
    const onLogBatchRef = useRef(onLogBatch);
    const onSSEStatusChangeRef = useRef(onSSEStatusChange);
    const lastHeartbeatRef = useRef(Date.now());
    const notificationQueueRef = useRef([]);
    const batchTimeoutRef = useRef(null);

    // --- I DUE RIFERIMENTI CHIAVE ---
    const eventSourceRef = useRef(null);
    const isConnectingRef = useRef(false); // IL LUCCHETTO
    const heartbeatTimerRef = useRef(null); // Ref per pulire l'intervallo specificamente

    useEffect(() => {
        onLogBatchRef.current = onLogBatch;
        onSSEStatusChangeRef.current = onSSEStatusChange;
    }, [onLogBatch, onSSEStatusChange]);

    const unlockAudio = useCallback(() => {
        setIsAudioUnlocked(true);
        console.log('🔊 [Audio] Monitoring alerts unlocked');
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhAAQACABAAAABkYXRhAgAAAAEA');
        audio.play().catch(() => { });
    }, []);

    const processNotificationQueue = useCallback(() => {
        if (notificationQueueRef.current.length === 0) return;

        const latest = notificationQueueRef.current[notificationQueueRef.current.length - 1];
        setNotification(latest);

        if (isAudioUnlocked) {
            const audio = new Audio('/notifica.mp3');
            audio.play().catch(() => { });
        }

        notificationQueueRef.current = [];
        batchTimeoutRef.current = null;
    }, [isAudioUnlocked]);

    const showNotification = useCallback((data) => {
        notificationQueueRef.current.push(data);
        if (!batchTimeoutRef.current) {
            batchTimeoutRef.current = setTimeout(processNotificationQueue, 500);
        }
    }, [processNotificationQueue]);

    useEffect(() => {
        let reconnectTimeout = null;
        let heartbeatCheckInterval = null;

        const connect = async () => {
            // 1. CONTROLLO LUCCHETTO: Se stiamo già provando a connetterci, non fare nulla
            if (isConnectingRef.current) return;

            // 2. CHIUDO IL LUCCHETTO: D'ora in poi, altre chiamate a connect() verranno ignorate
            isConnectingRef.current = true;

            // Pulizia preventiva
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const token = getToken();
            if (!token) {
                isConnectingRef.current = false; // Riapro se manca il token
                return;
            }

            try {
                console.log("📡 Richiesta ticket in corso...");
                const response = await fetch('/api/stream-ticket', {
                    headers: { 'x-admin-token': token }
                });

                if (!response.ok) throw new Error(`Ticket error: ${response.status}`);

                const { ticket } = await response.json();
                if (!ticket) throw new Error('No ticket received');

                const es = new EventSource(`/api/stream?token=${ticket}`);
                eventSourceRef.current = es;

                es.onopen = () => {
                    setSseStatus('connected');
                    onSSEStatusChangeRef.current?.(true);
                    lastHeartbeatRef.current = Date.now();
                    console.debug('✅ SSE Connected');

                    // 3. RIAPRO IL LUCCHETTO: La connessione è attiva, siamo pronti per il futuro
                    isConnectingRef.current = false;
                };

                es.onerror = () => {
                    setSseStatus('error');
                    onSSEStatusChangeRef.current?.(false);
                    es.close();

                    // 4. RIAPRO IL LUCCHETTO: In caso di errore dobbiamo poter riprovare
                    isConnectingRef.current = false;

                    console.warn('⚠️ SSE Error. Retrying in 10s...');
                    reconnectTimeout = setTimeout(connect, 10000);
                };

                es.onmessage = (event) => {
                    lastHeartbeatRef.current = Date.now();
                    if (event.data === ': heartbeat') return;

                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'CRITICAL_RISK') {
                            showNotification(data);
                        } else if (data.type === 'THREAT_SYNTHESIS') {
                            onLogBatchRef.current?.(data);
                        } else if (data.type === 'LOG_BATCH' || data.type === 'TERMINAL_ACTIVITY') {
                            onLogBatchRef.current?.();
                        }
                    } catch (e) {
                        console.error("SSE Parse Error", e);
                    }
                };

                heartbeatCheckInterval = setInterval(() => {
                    const diff = Date.now() - lastHeartbeatRef.current;
                    if (diff > 45000) {
                        console.warn('🚨 SSE Heartbeat lost.');
                        setSseStatus('stale');
                        onSSEStatusChangeRef.current?.(false);
                        connect();
                    }
                }, 15000);

            } catch (error) {
                console.error('❌ SSE Init Error:', error.message);
                setSseStatus('error');

                // 5. RIAPRO IL LUCCHETTO: Anche in caso di eccezione catch, liberiamo la funzione
                isConnectingRef.current = false;
                reconnectTimeout = setTimeout(connect, 10000);
            }
        };

        connect();

        return () => {
            console.log("🧹 Cleanup SSE...");
            if (eventSourceRef.current) eventSourceRef.current.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            if (heartbeatCheckInterval) clearInterval(heartbeatCheckInterval);
            if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
            isConnectingRef.current = false; // Reset finale
        };
    }, [getToken, showNotification]);

    return { notification, setNotification, isAudioUnlocked, unlockAudio, sseStatus };
};
*/