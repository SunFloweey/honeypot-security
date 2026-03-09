import React, { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useSSENotifications } from '../hooks/useSSENotifications';
import { usePollingManager } from '../hooks/usePollingManager';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useDebounce } from '../hooks/useDebounce';

// Components
import DashboardSidebar from './components/DashboardSidebar';
import DashboardOverview from './components/DashboardOverview';
import RecentLogsTable from './components/RecentLogsTable';
import SessionDetail from './components/SessionDetail';
import LogDetailModal from './components/LogDetailModal';
import ToastNotification from './components/ToastNotification';
import PayloadAnalyzer from './components/PayloadAnalyzer';
import HoneytokenMonitor from './components/HoneytokenMonitor';
import TerminalMonitor from './components/TerminalMonitor';
import ApiKeyManager from './components/ApiKeyManager';
import TenantManager from './components/TenantManager';

const AdminDashboard = () => {
    React.useEffect(() => {
        document.title = "ViperScan Intelligence - Security Dashboard";
    }, []);

    // Auth
    const { getToken } = useAdminAuth();

    // UI State
    const [selectedLog, setSelectedLog] = useState(null);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [riskFilter, setRiskFilter] = useState(0);
    const [ipFilter, setIpFilter] = useState(''); // Filtro IP
    const [fingerprintFilter, setFingerprintFilter] = useState(''); // Nuovo filtro Fingerprint

    // Debounced values per le query pesanti
    const debouncedIP = useDebounce(ipFilter, 500);
    const debouncedFingerprint = useDebounce(fingerprintFilter, 500);

    const [dateFilter, setDateFilter] = useState(''); // Filtro DATA
    const [view, setView] = useState('overview');
    const [viewData, setViewData] = useState(null);
    const [order, setOrder] = useState('DESC');
    const [liveAnalysis, setLiveAnalysis] = useState(null);

    // Data Management
    const { stats, logs, totalLogs, loading, page, fetchData } = useDashboardData(riskFilter, debouncedIP, debouncedFingerprint, 50, dateFilter, order);

    // Polling Manager (adattivo basato su SSE)
    const { setSSEStatus } = usePollingManager(fetchData);

    // SSE Real-time Notifications
    const handleLogBatch = React.useCallback((data) => {
        fetchData(true); // Aggiorna i log
        if (data?.type === 'THREAT_SYNTHESIS') {
            setLiveAnalysis(data); // Salva l'analisi IA istantanea
        }
    }, [fetchData]);

    const { notification, setNotification, isAudioUnlocked, unlockAudio, sseStatus } = useSSENotifications(
        handleLogBatch,
        setSSEStatus            // onSSEStatusChange: regola polling (di solito setSSEStatus è stabile)
    );

    // Toggle Order
    const toggleOrder = () => setOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC');

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
        <div className={`dashboard-layout ${mobileSidebarOpen ? 'mobile-sidebar-open' : ''}`}>
            {/* Sidebar Overlay for Mobile */}
            <div className="sidebar-overlay" onClick={() => setMobileSidebarOpen(false)}></div>

            {/* Mobile Toggle Button */}
            <button
                className="sidebar-mobile-toggle"
                onClick={() => setMobileSidebarOpen(true)}
            >
                ☰ MENU
            </button>

            <DashboardSidebar
                view={view}
                setView={(v) => { setView(v); setMobileSidebarOpen(false); }}
                refreshData={() => fetchData(true)}
                riskFilter={riskFilter}
                setRiskFilter={setRiskFilter}
                ipFilter={ipFilter}
                setIpFilter={setIpFilter}
                availableIPs={stats?.topIPs || []}
                fingerprintFilter={fingerprintFilter}
                setFingerprintFilter={setFingerprintFilter}
                topFingerprints={stats?.topFingerprints || []}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                isAudioUnlocked={isAudioUnlocked}
                unlockAudio={unlockAudio}
                sseStatus={sseStatus}
                onCloseMobile={() => setMobileSidebarOpen(false)}
            />

            <main className="dashboard-main">
                {view === 'overview' && (
                    <DashboardOverview
                        stats={stats}
                        logs={logs}
                        totalLogs={totalLogs}
                        currentPage={page}
                        onPageChange={(p) => fetchData(false, p)}
                        riskFilter={riskFilter}
                        onInvestigateLog={handleInvestigateLog}
                        onFilterIP={setIpFilter}
                        onFilterFingerprint={setFingerprintFilter}
                        order={order}
                        onToggleOrder={toggleOrder}
                        liveAnalysis={liveAnalysis}
                    />
                )}

                {view === 'logs_list' && (
                    <>
                        <header className="mb-2">
                            <h1>All Logs</h1>
                            <p className="text-muted">
                                Archivio completo delle attività (Totale: {totalLogs})
                            </p>
                        </header>
                        <RecentLogsTable
                            logs={logs}
                            totalLogs={totalLogs}
                            currentPage={page}
                            onPageChange={(p) => fetchData(false, p)}
                            riskFilter={riskFilter}
                            onInvestigate={handleInvestigateLog}
                            onFilterIP={setIpFilter}
                            onFilterFingerprint={setFingerprintFilter}
                            order={order}
                            onToggleOrder={toggleOrder}
                            limit={50}
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

                {view === 'payload_lab' && (
                    <PayloadAnalyzer />
                )}

                {view === 'honeytokens' && (
                    <HoneytokenMonitor />
                )}

                {view === 'terminal' && (
                    <TerminalMonitor />
                )}

                {view === 'api_keys' && (
                    <ApiKeyManager />
                )}

                {view === 'tenants' && (
                    <TenantManager />
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