import { useState, useCallback, useEffect, useRef } from 'react';
import { useAdminAuth } from './useAdminAuth';

export const useDashboardData = (riskFilter = 0, ipFilter = '', fingerprintFilter = '', limit = 50, dateFilter = '', order = 'DESC') => {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const { getToken } = useAdminAuth();

    const workerRef = useRef(null);
    const pageRef = useRef(page);

    // Sincronizza il ref con lo stato
    useEffect(() => {
        pageRef.current = page;
    }, [page]);

    // --- I DUE STRUMENTI DI CONTROLLO ---
    const isFetchingRef = useRef(false); // Il lucchetto
    const abortControllerRef = useRef(null); // Il "killer" delle richieste vecchie

    useEffect(() => {
        workerRef.current = new Worker(new URL('../workers/logWorker.js', import.meta.url), { type: 'module' });
        workerRef.current.onmessage = (e) => {
            if (e.data.type === 'LOGS_PROCESSED') {
                setLogs(e.data.payload.logs);
            }
        };
        return () => workerRef.current.terminate();
    }, []);

    const fetchData = useCallback(async (isBackground = false, targetPage) => {
        // 1. SE C'È GIÀ UNA RICHIESTA, CANCELLIAMOLA (Cleaning the pipes)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            // console.log("🛑 Vecchia richiesta cancellata");
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const effectivePage = targetPage !== undefined ? targetPage : pageRef.current;
        if (!isBackground) setLoading(true);

        const token = getToken();
        if (!token) {
            setLoading(false);
            return;
        }

        // Determina quale header usare
        const headers = localStorage.getItem('saasToken')
            ? { 'Authorization': `Bearer ${token}` }
            : { 'x-admin-token': token };

        isFetchingRef.current = true;

        try {
            const offset = (effectivePage - 1) * limit;
            let logsUrl = `/api/logs?limit=${limit}&offset=${offset}&risk_min=${riskFilter}&order=${order}`;
            if (dateFilter) logsUrl += `&date=${encodeURIComponent(dateFilter)}`;

            if (ipFilter) logsUrl += `&ipAddress=${encodeURIComponent(ipFilter)}`;
            if (fingerprintFilter) logsUrl += `&fingerprint=${encodeURIComponent(fingerprintFilter)}`;

            let statsUrl = `/api/overview`;
            if (dateFilter) statsUrl += `?date=${encodeURIComponent(dateFilter)}`;

            const [statsRes, logsRes] = await Promise.all([
                fetch(statsUrl, {
                    headers,
                    signal: controller.signal
                }),
                fetch(logsUrl, {
                    headers,
                    signal: controller.signal
                })
            ]);

            if (!statsRes.ok || !logsRes.ok) {
                if (statsRes.status === 401 || logsRes.status === 401) {
                    // Auth failure handled by checkAuth elsewhere or here
                }
                throw new Error('API Error');
            }

            const statsData = await statsRes.json();
            const logsData = await logsRes.json();

            setStats(statsData);

            if (workerRef.current) {
                workerRef.current.postMessage({
                    type: 'PROCESS_LOGS',
                    payload: {
                        logs: logsData.rows || [],
                        riskFilter,
                        ipFilter,
                        fingerprintFilter
                    }
                });
            }

            setTotalLogs(logsData.count || 0);
            if (targetPage !== undefined) setPage(targetPage);

        } catch (error) {
            if (error.name === 'AbortError') {
                // console.log("✅ Richiesta precedente annullata correttamente.");
            } else {
                console.error("Error fetching dashboard data:", error);
            }
        } finally {
            isFetchingRef.current = false;
            if (!isBackground) setLoading(false);
        }
    }, [riskFilter, ipFilter, fingerprintFilter, dateFilter, getToken, limit, order]);

    // Effetto per il caricamento iniziale e cambio filtri
    useEffect(() => {
        setPage(1);
        fetchData(false, 1);

        // Cleanup quando il componente smonta
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [riskFilter, ipFilter, fingerprintFilter, dateFilter, order, fetchData]); // Rimosso fetchData dalle dipendenze per evitare loop

    return {
        stats, logs, totalLogs, loading, page,
        setPage, fetchData, setStats, setLogs
    };
};

//import { useState, useCallback, useEffect, useRef } from 'react';
//import { useAdminAuth } from './useAdminAuth';

/**
 * Hook per gestire il fetching dei dati dashboard
 */ /*
export const useDashboardData = (riskFilter = 0, ipFilter = '', fingerprintFilter = '', limit = 50, dateFilter = '', order = 'DESC') => {
 const [stats, setStats] = useState(null);
 const [logs, setLogs] = useState([]);
 const [totalLogs, setTotalLogs] = useState(0);
 const [loading, setLoading] = useState(true);
 const [page, setPage] = useState(1);
 const { getToken, checkAuth } = useAdminAuth();

 // Web Worker for off-thread processing
 const workerRef = useRef(null);

 useEffect(() => {
     // Instantiate Vite worker
     workerRef.current = new Worker(new URL('../workers/logWorker.js', import.meta.url), { type: 'module' });

     workerRef.current.onmessage = (e) => {
         if (e.data.type === 'LOGS_PROCESSED') {
             setLogs(e.data.payload.logs);
             // setTotalLogs(e.data.payload.count); // Optional: if worker filters, count changes
         }
     };

     return () => workerRef.current.terminate();
 }, []);

 const fetchData = useCallback(async (isBackground = false, targetPage) => {
     // Se targetPage non è fornito, usa la pagina corrente
     const effectivePage = targetPage !== undefined ? targetPage : page;

     if (!isBackground) setLoading(true);
     const token = getToken();
     if (!token) return;

     try {
         const offset = (effectivePage - 1) * limit;

         // Costruisci URL per i logs con filtri opzionali
         let logsUrl = `/api/logs?limit=${limit}&offset=${offset}&risk_min=${riskFilter}&order=${order}`;
         if (dateFilter) {
             logsUrl += `&date=${encodeURIComponent(dateFilter)}`;
         } else {
             logsUrl += `&timespan=24h`; // <--- Sincronizza la tabella con l'overview
         }

         if (ipFilter) logsUrl += `&ipAddress=${encodeURIComponent(ipFilter)}`;
         if (fingerprintFilter) logsUrl += `&fingerprint=${encodeURIComponent(fingerprintFilter)}`;
         if (dateFilter) logsUrl += `&date=${encodeURIComponent(dateFilter)}`;

         let statsUrl = `/api/overview`;
         if (dateFilter) statsUrl += `?date=${encodeURIComponent(dateFilter)}`;

         const [statsRes, logsRes] = await Promise.all([
             fetch(statsUrl, { headers: { 'x-admin-token': token } }),
             fetch(logsUrl, { headers: { 'x-admin-token': token } })
         ]);

         const statsData = await statsRes.json();
         const logsData = await logsRes.json();

         setStats(statsData);

         // Send to worker for sorting/filtering/processing
         workerRef.current.postMessage({
             type: 'PROCESS_LOGS',
             payload: {
                 logs: logsData.rows || [],
                 riskFilter,
                 ipFilter,
                 fingerprintFilter
             }
         });

         setTotalLogs(logsData.count || 0);

         // Aggiorna lo stato della pagina solo se esplicitamente richiesto
         if (targetPage !== undefined) setPage(targetPage);
     } catch (error) {
         console.error("Error fetching dashboard data:", error);
     } finally {
         if (!isBackground) setLoading(false);
     }
 }, [riskFilter, ipFilter, fingerprintFilter, dateFilter, getToken, checkAuth, limit, page, order]);

 // Quando i filtri cambiano, resetta la pagina a 1 e ricarica
 useEffect(() => {
     setPage(1);
     fetchData(false, 1);
 }, [riskFilter, ipFilter, fingerprintFilter, dateFilter, order]);

 return {
     stats,
     logs,
     totalLogs,
     loading,
     page,
     setPage,
     fetchData,
     setStats,
     setLogs
 };
};*/