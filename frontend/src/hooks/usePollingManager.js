import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook per gestire polling intelligente
 * - SSE connesso: polling ogni 120s (health check)
 * - SSE disconnesso: polling ogni 30s (backup)
 */
export const usePollingManager = (fetchData) => {
    const timeoutRef = useRef(null);
    const isSSEConnectedRef = useRef(false);

    const setSSEStatus = useCallback((connected) => {
        isSSEConnectedRef.current = connected;
        console.debug(`🔄 Polling: ${connected ? 'slow mode (120s)' : 'fast mode (30s)'}`);
    }, []);

    useEffect(() => {
        const poll = () => {
            fetchData(true); // background fetch (no spinner)

            // Polling adattivo basato su stato SSE
            const interval = isSSEConnectedRef.current ? 120000 : 30000;
            timeoutRef.current = setTimeout(poll, interval);
        };

        // Rimosso fetch iniziale ridondante (lo fa già useDashboardData)

        // Avvia polling dopo l'intervallo iniziale
        const initialWait = isSSEConnectedRef.current ? 120000 : 30000;
        timeoutRef.current = setTimeout(poll, initialWait);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [fetchData]); // Dipende solo da fetchData per stabilità

    return { setSSEStatus };
};