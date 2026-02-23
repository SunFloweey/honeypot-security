import React from 'react';
import { useNavigate } from 'react-router-dom';

const DashboardSidebar = ({
    view,
    setView,
    refreshData,
    riskFilter,
    setRiskFilter,
    ipFilter,
    setIpFilter,
    availableIPs = [],
    fingerprintFilter,
    setFingerprintFilter,
    topFingerprints = [],
    dateFilter,
    setDateFilter,
    isAudioUnlocked,
    unlockAudio,
    sseStatus = 'connecting'
}) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        navigate('/researcher-login');
    };

    return (
        <aside className="dashboard-sidebar">
            <h2 className="text-researcher" style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>🛡️ HONEYPOT ANALYTICS</h2>

            {/* Audio Unlock / Monitoring Button */}
            {!isAudioUnlocked ? (
                <button
                    onClick={unlockAudio}
                    className="sidebar-link"
                    style={{
                        backgroundColor: 'var(--researcher-green)',
                        color: '#000',
                        fontWeight: 'bold',
                        marginBottom: '1.5rem',
                        textAlign: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        borderRadius: '4px'
                    }}
                >
                    ▶️ AVVIA MONITORAGGIO
                </button>
            ) : (
                <div
                    className="sidebar-link"
                    style={{
                        color: sseStatus === 'connected' ? 'var(--researcher-green)' :
                            sseStatus === 'stale' ? 'var(--warning)' : 'var(--danger)',
                        borderColor: sseStatus === 'connected' ? 'var(--researcher-green)' :
                            sseStatus === 'stale' ? 'var(--warning)' : 'var(--danger)',
                        opacity: 0.8,
                        marginBottom: '1.5rem',
                        textAlign: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        border: '1px dashed',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                    }}
                >
                    <div>📡 MONITORAGGIO {sseStatus === 'connected' ? 'ATTIVO' : sseStatus.toUpperCase()}</div>
                    {sseStatus === 'stale' && <small style={{ fontSize: '0.5rem' }}>HEARTBEAT LOST</small>}
                </div>
            )}

            <nav className="sidebar-nav">
                <button
                    className={`sidebar-link ${view === 'overview' ? 'active' : ''}`}
                    onClick={() => { setView('overview'); refreshData(); }}
                    style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                >
                    Overview
                </button>
                <button
                    className={`sidebar-link ${view === 'logs_list' ? 'active' : ''}`}
                    onClick={() => setView('logs_list')}
                    style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                >
                    Log Archive
                </button>
                <button
                    className={`sidebar-link ${view === 'honeytokens' ? 'active' : ''}`}
                    onClick={() => setView('honeytokens')}
                    style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                >
                    🍯 Honeytokens
                </button>
                <button
                    className={`sidebar-link ${view === 'terminal' ? 'active' : ''}`}
                    onClick={() => setView('terminal')}
                    style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                >
                    🖥️ Virtual Shells
                </button>

                <div className="sidebar-footer mt-2" style={{ backgroundColor: 'transparent', padding: '10px', borderTop: '1px solid var(--researcher-border)' }}>
                    <small className="text-muted block mb-1">FILTERS</small>

                    {/* Date Filter (CALENDAR) */}
                    <div className="mb-2">
                        <label className="font-tiny text-muted block mb-1">Filter by Day:</label>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            max={new Date().toISOString().split("T")[0]}
                            style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.5)',
                                border: '1px solid var(--researcher-border)',
                                color: '#ffffff',
                                fontSize: '0.9rem',
                                padding: '6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                colorScheme: 'dark'
                            }}
                        />
                    </div>

                    {/* Risk Filter */}
                    <div className="mb-2">
                        <label className="font-tiny text-muted block mb-1">Min Risk Score: {riskFilter}</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={riskFilter}
                            onChange={(e) => setRiskFilter(e.target.value)}
                            className="w-full"
                        />
                    </div>

                    {/* IP Address Filter */}
                    <div className="mb-2">
                        <label className="font-tiny text-muted block mb-1">Filter by IP Address:</label>
                        <select
                            value={ipFilter}
                            onChange={(e) => { setIpFilter(e.target.value); setFingerprintFilter(''); }}
                            className="w-full monospace"
                            style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid var(--researcher-border)',
                                color: 'var(--researcher-green)',
                                fontSize: '0.75rem',
                                padding: '4px'
                            }}
                        >
                            <option value="">All Addresses</option>
                            {availableIPs.map(ip => (
                                <option key={ip.ipAddress} value={ip.ipAddress}>
                                    {ip.ipAddress} ({ip.count})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Fingerprint Intelligence */}
                    <div className="mb-1">
                        <label className="font-tiny text-muted block mb-1">Browser Intel (Multi-IP):</label>
                        <select
                            value={fingerprintFilter}
                            onChange={(e) => { setFingerprintFilter(e.target.value); setIpFilter(''); }}
                            className="w-full monospace"
                            style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid var(--researcher-border)',
                                color: '#a78bfa',
                                fontSize: '0.75rem',
                                padding: '4px'
                            }}
                        >
                            <option value="">All Devices</option>
                            {topFingerprints.map(fp => (
                                <option key={fp.fingerprint} value={fp.fingerprint}>
                                    {fp.fingerprint.substring(0, 8)} ({fp.uniqueIPs} IPs)
                                </option>
                            ))}
                        </select>
                        {(ipFilter || fingerprintFilter || dateFilter) && (
                            <button
                                onClick={() => { setIpFilter(''); setFingerprintFilter(''); setDateFilter(''); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--danger)',
                                    fontSize: '0.7rem',
                                    cursor: 'pointer',
                                    marginTop: '8px',
                                    padding: 0
                                }}
                            >
                                ✕ Clear All Filters
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <div className="mt-auto pt-2">
                <button
                    onClick={handleLogout}
                    className="sidebar-link"
                    style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                >
                    Logout
                </button>
            </div>
        </aside>
    );
};

export default DashboardSidebar;
