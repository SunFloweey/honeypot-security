import { useEffect, useRef } from 'react';

/**
 * Hook per gestire polling intelligente
 * - SSE connesso: polling ogni 120s (health check)
 * - SSE disconnesso: polling ogni 30s (backup)
 */
export const usePollingManager = (fetchData, dependencies = []) => {
    const timeoutRef = useRef(null);
    const isSSEConnectedRef = useRef(false);

    const setSSEStatus = (connected) => {
        isSSEConnectedRef.current = connected;
        console.log(`🔄 Polling: ${connected ? 'slow mode (120s)' : 'fast mode (30s)'}`);
    };

    useEffect(() => {
        const poll = () => {
            fetchData(true); // background fetch (no spinner)

            // Polling adattivo basato su stato SSE
            const interval = isSSEConnectedRef.current ? 120000 : 30000;
            timeoutRef.current = setTimeout(poll, interval);
        };

        // Fetch iniziale
        fetchData(false);

        // Avvia polling dopo 60s
        timeoutRef.current = setTimeout(poll, 60000);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

    return { setSSEStatus };
};