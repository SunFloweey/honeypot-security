import { useState, useCallback } from 'react';
import { useAdminAuth } from './useAdminAuth';

/**
 * Hook per gestire il fetching dei dati dashboard
 * Stats globali + logs filtrati per livello di rischio
 */
export const useDashboardData = (riskFilter = 0) => {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const { getToken, checkAuth } = useAdminAuth();

    const fetchData = useCallback(async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        const token = getToken();
        if (!token) return;

        try {
            const [statsRes, logsRes] = await Promise.all([
                fetch('/api/overview', {
                    headers: { 'x-admin-token': token }
                }),
                fetch(`/api/logs?limit=50&risk_min=${riskFilter}`, {
                    headers: { 'x-admin-token': token }
                })
            ]);

            // Check autenticazione
            if (!checkAuth(statsRes) || !checkAuth(logsRes)) return;

            setStats(await statsRes.json());
            const logsData = await logsRes.json();
            setLogs(logsData.rows || []);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, [riskFilter, getToken, checkAuth]);

    return {
        stats,
        logs,
        loading,
        fetchData,
        setStats,
        setLogs
    };
};