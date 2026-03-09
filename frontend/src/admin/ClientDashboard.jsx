import React, { useState } from 'react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useSSENotifications } from '../hooks/useSSENotifications';
import { usePollingManager } from '../hooks/usePollingManager';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useDebounce } from '../hooks/useDebounce';

// Components (Reusing existing ones but in a restricted layout)
import DashboardSidebar from './components/DashboardSidebar';
import DashboardOverview from './components/DashboardOverview';
import RecentLogsTable from './components/RecentLogsTable';
import SessionDetail from './components/SessionDetail';
import LogDetailModal from './components/LogDetailModal';
import ToastNotification from './components/ToastNotification';
import PayloadAnalyzer from './components/PayloadAnalyzer';
import HoneytokenMonitor from './components/HoneytokenMonitor';
import ApiKeyManager from './components/ApiKeyManager';
import TerminalMonitor from './components/TerminalMonitor';

/**
 * ClientDashboard - Versione specifica per i Clienti SaaS
 * Isolata dalla gestione globale dell'amministratore.
 */
const ClientDashboard = () => {
    React.useEffect(() => {
        document.title = "ViperScan - My Security Dashboard";
    }, []);

    const { getToken, getUser } = useAdminAuth();
    const user = getUser();

    // UI State
    const [selectedLog, setSelectedLog] = useState(null);
    const [riskFilter, setRiskFilter] = useState(0);
    const [ipFilter, setIpFilter] = useState('');
    const [fingerprintFilter, setFingerprintFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [view, setView] = useState('overview');
    const [viewData, setViewData] = useState(null);
    const [order, setOrder] = useState('DESC');
    const [liveAnalysis, setLiveAnalysis] = useState(null);

    const debouncedIP = useDebounce(ipFilter, 500);
    const debouncedFingerprint = useDebounce(fingerprintFilter, 500);

    // Data Management
    const { stats, logs, totalLogs, loading, page, fetchData } = useDashboardData(
        riskFilter, debouncedIP, debouncedFingerprint, 50, dateFilter, order
    );

    const { setSSEStatus } = usePollingManager(fetchData);

    const handleLogBatch = React.useCallback((data) => {
        fetchData(true);
        if (data?.type === 'THREAT_SYNTHESIS') {
            setLiveAnalysis(data);
        }
    }, [fetchData]);

    const { notification, setNotification, isAudioUnlocked, unlockAudio, sseStatus } = useSSENotifications(
        handleLogBatch,
        setSSEStatus
    );

    const toggleOrder = () => setOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC');

    const showSessionTimeline = async (sessionKey) => {
        try {
            const token = getToken();
            const isSaaS = !!localStorage.getItem('saasToken');
            
            const headers = isSaaS 
                ? { 'Authorization': `Bearer ${token}` } 
                : { 'x-admin-token': token };

            const res = await fetch(`/api/session/${sessionKey}`, {
                headers
            });
            const data = await res.json();
            
            if (res.status === 401 || res.status === 403) {
                console.error('🔒 Accesso negato alla sessione:', data.error);
                return;
            }

            setViewData(data);
            setView('session');
        } catch (error) {
            console.error('Error:', error);
        }
    };

    if (loading && !stats && view === 'overview') {
        return (
            <div className="flex-center" style={{ backgroundColor: '#0f172a', color: '#10b981' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="auth-logo-img mb-2" style={{ fontSize: '2rem' }}>🛡️</div>
                    <p>Caricamento dei tuoi dati di sicurezza...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-layout client-mode">
            <DashboardSidebar
                view={view}
                setView={setView}
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
            />

            <main className="dashboard-main">
                <div style={{
                    padding: '8px 16px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: '0.8rem',
                    color: '#10b981',
                    display: 'flex',
                    justifyContent: 'space-between'
                }}>
                    <span>Project: {user?.name || 'My Site'}</span>
                    <span>Multi-Tenant Shield Active</span>
                </div>

                {view === 'overview' && (
                    <DashboardOverview
                        stats={stats}
                        logs={logs}
                        totalLogs={totalLogs}
                        currentPage={page}
                        onPageChange={(p) => fetchData(false, p)}
                        riskFilter={riskFilter}
                        onInvestigateLog={(log) => { setSelectedLog(log); showSessionTimeline(log.sessionKey); }}
                        onFilterIP={setIpFilter}
                        onFilterFingerprint={setFingerprintFilter}
                        order={order}
                        onToggleOrder={toggleOrder}
                        liveAnalysis={liveAnalysis}
                    />
                )}

                {view === 'logs_list' && (
                    <RecentLogsTable
                        logs={logs}
                        totalLogs={totalLogs}
                        currentPage={page}
                        onPageChange={(p) => fetchData(false, p)}
                        riskFilter={riskFilter}
                        onInvestigate={(log) => { setSelectedLog(log); showSessionTimeline(log.sessionKey); }}
                        onFilterIP={setIpFilter}
                        onFilterFingerprint={setFingerprintFilter}
                        order={order}
                        onToggleOrder={toggleOrder}
                        limit={50}
                    />
                )}

                {view === 'session' && (
                    <SessionDetail
                        viewData={viewData}
                        onBack={() => setView('overview')}
                        onSelectLog={setSelectedLog}
                    />
                )}

                {view === 'api_keys' && (
                    <ApiKeyManager />
                )}

                {view === 'honeytokens' && (
                    <HoneytokenMonitor />
                )}

                {view === 'payload_lab' && (
                    <PayloadAnalyzer />
                )}

                {view === 'terminal' && (
                    <TerminalMonitor />
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

export default ClientDashboard;
