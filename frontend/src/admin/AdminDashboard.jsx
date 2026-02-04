/* import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CONFIG from '../config';

// Components
import DashboardSidebar from './components/DashboardSidebar';
import DashboardOverview from './components/DashboardOverview';
import RecentLogsTable from './components/RecentLogsTable';
import SessionDetail from './components/SessionDetail';
import LogDetailModal from './components/LogDetailModal';
import ToastNotification from './components/ToastNotification';

const AdminDashboard = () => {
    // State
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [riskFilter, setRiskFilter] = useState(0);
    const [view, setView] = useState('overview');
    const [viewData, setViewData] = useState(null);
    const [dataVersion, setDataVersion] = useState(0);
    const [notification, setNotification] = useState(null);

    const navigate = useNavigate();

    const getToken = () => localStorage.getItem('adminToken');

    // Data Fetching
    const fetchData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        const token = getToken();

        if (!token) {
            navigate('/researcher-login');
            return;
        }

        try {
            const [statsRes, logsRes] = await Promise.all([
                fetch('/api/overview', { headers: { 'x-admin-token': token } }),
                fetch(`/api/logs?limit=50&risk_min=${riskFilter}`, { headers: { 'x-admin-token': token } })
            ]);

            if (statsRes.status === 401 || logsRes.status === 401) {
                localStorage.removeItem('adminToken');
                navigate('/researcher-login');
                return;
            }

            setStats(await statsRes.json());
            const logsData = await logsRes.json();
            setLogs(logsData.rows || []);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    // Polling & Heartbeat
    useEffect(() => {
        let timeoutId;
        let isSSEConnected = false; // Traccia stato SSE

        const poll = () => {
            fetchData(true);
            // Se SSE è connesso, polling più lento (120s), altrimenti ogni 30s
            const interval = isSSEConnected ? 120000 : 30000;
            timeoutId = setTimeout(poll, interval);
        };

        fetchData(false);

        // Esponi funzione per controllare SSE
        window.__setSSEStatus = (connected) => {
            isSSEConnected = connected;
        };

        timeoutId = setTimeout(poll, 60000);

        return () => clearTimeout(timeoutId);
    }, [riskFilter]);

    // Real-time Notifications (SSE)
    useEffect(() => {
        const token = getToken();
        if (!token) return;

        const eventSource = new EventSource(`/api/stream?token=${token}`);

        eventSource.onopen = () => {
            window.__setSSEStatus?.(true);
            console.log('SSE connesso - polling ridotto');
        };

        eventSource.onerror = () => {
            window.__setSSEStatus?.(false);
            console.log('SSE disconnesso - polling normale');
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'CRITICAL_RISK') {
                    showNotification(data);
                } else if (data.type === 'LOG_BATCH') {
                    fetchData(true);
                }
            } catch (e) {
                console.error("SSE Parse Error", e);
            }
        };

        return () => {
            window.__setSSEStatus?.(false);

            eventSource.close();
        };
    }, []);

    // Actions
    const showNotification = (data) => {
        setNotification(data);
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
        audio.play().catch(e => console.log('Audio play failed', e));
    };

    const showSessionTimeline = async (sessionKey) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/session/${sessionKey}`, { headers: { 'x-admin-token': getToken() } });
            const data = await res.json();
            setViewData(data);
            setView('session');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleInvestigateLog = (log) => {
        setSelectedLog(log);
        showSessionTimeline(log.sessionKey);
    };

    // Render Helpers
    if (loading && !stats && view === 'overview') {
        return <div className="flex-center" style={{ backgroundColor: 'var(--researcher-bg)', color: 'var(--researcher-green)' }}>Inizializzazione Honeypot Dashboard...</div>;
    }

    return (
        <div className="dashboard-layout">
            <DashboardSidebar
                view={view}
                setView={setView}
                refreshData={() => fetchData(true)}
                riskFilter={riskFilter}
                setRiskFilter={setRiskFilter}
            />

            <main className="dashboard-main">
                {view === 'overview' && (
                    <DashboardOverview
                        stats={stats}
                        logs={logs}
                        riskFilter={riskFilter}
                        onInvestigateLog={handleInvestigateLog}
                    />
                )}

                {view === 'logs_list' && (
                    <>
                        <header className="mb-2">
                            <h1>Recent Logs</h1>
                            <p className="text-muted">Lista completa delle attività recenti</p>
                        </header>
                        <RecentLogsTable
                            logs={logs}
                            riskFilter={riskFilter}
                            onInvestigate={handleInvestigateLog}
                            limit={100}
                        />
                    </>
                )}

                {view === 'session' && (
                    <SessionDetail
                        viewData={viewData}
                        onBack={() => setView('overview')}
                        onSelectLog={setSelectedLog}
                    />
                )}
            </main>

            <LogDetailModal
                log={selectedLog}
                onClose={() => setSelectedLog(null)}
            />

            <ToastNotification
                notification={notification}
                onClose={() => setNotification(null)}
                onInvestigate={showSessionTimeline}
            />
        </div>
    );
};

export default AdminDashboard;
*/

import React, { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useSSENotifications } from '../hooks/useSSENotifications';
import { usePollingManager } from '../hooks/usePollingManager';
import { useAdminAuth } from '../hooks/useAdminAuth';

// Components
import DashboardSidebar from './components/DashboardSidebar';
import DashboardOverview from './components/DashboardOverview';
import RecentLogsTable from './components/RecentLogsTable';
import SessionDetail from './components/SessionDetail';
import LogDetailModal from './components/LogDetailModal';
import ToastNotification from './components/ToastNotification';

const AdminDashboard = () => {
    // Auth
    const { getToken } = useAdminAuth();

    // UI State
    const [selectedLog, setSelectedLog] = useState(null);
    const [riskFilter, setRiskFilter] = useState(0);
    const [view, setView] = useState('overview');
    const [viewData, setViewData] = useState(null);

    // Data Management
    const { stats, logs, loading, fetchData } = useDashboardData(riskFilter);

    // Polling Manager (adattivo basato su SSE)
    const { setSSEStatus } = usePollingManager(fetchData, [riskFilter]);

    // SSE Real-time Notifications
    const { notification, setNotification } = useSSENotifications(
        () => fetchData(true),  // onLogBatch: aggiorna dati
        setSSEStatus            // onSSEStatusChange: regola polling
    );

    // Session Detail Fetch
    const showSessionTimeline = async (sessionKey) => {
        try {
            const res = await fetch(`/api/session/${sessionKey}`, {
                headers: { 'x-admin-token': getToken() }
            });
            const data = await res.json();
            setViewData(data);
            setView('session');
        } catch (error) {
            console.error('Error fetching session:', error);
        }
    };

    const handleInvestigateLog = (log) => {
        setSelectedLog(log);
        showSessionTimeline(log.sessionKey);
    };

    // Loading State
    if (loading && !stats && view === 'overview') {
        return (
            <div
                className="flex-center"
                style={{
                    backgroundColor: 'var(--researcher-bg)',
                    color: 'var(--researcher-green)'
                }}
            >
                Inizializzazione Honeypot Dashboard...
            </div>
        );
    }

    return (
        <div className="dashboard-layout">
            <DashboardSidebar
                view={view}
                setView={setView}
                refreshData={() => fetchData(true)}
                riskFilter={riskFilter}
                setRiskFilter={setRiskFilter}
            />

            <main className="dashboard-main">
                {view === 'overview' && (
                    <DashboardOverview
                        stats={stats}
                        logs={logs}
                        riskFilter={riskFilter}
                        onInvestigateLog={handleInvestigateLog}
                    />
                )}

                {view === 'logs_list' && (
                    <>
                        <header className="mb-2">
                            <h1>Recent Logs</h1>
                            <p className="text-muted">
                                Lista completa delle attività recenti
                            </p>
                        </header>
                        <RecentLogsTable
                            logs={logs}
                            riskFilter={riskFilter}
                            onInvestigate={handleInvestigateLog}
                            limit={100}
                        />
                    </>
                )}

                {view === 'session' && (
                    <SessionDetail
                        viewData={viewData}
                        onBack={() => setView('overview')}
                        onSelectLog={setSelectedLog}
                    />
                )}
            </main>

            <LogDetailModal
                log={selectedLog}
                onClose={() => setSelectedLog(null)}
            />

            <ToastNotification
                notification={notification}
                onClose={() => setNotification(null)}
                onInvestigate={showSessionTimeline}
            />
        </div>
    );
};

export default AdminDashboard;