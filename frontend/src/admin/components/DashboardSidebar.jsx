import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';

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
    sseStatus = 'connecting',
    onCloseMobile // New prop
}) => {
    const { getUser, logout } = useAdminAuth();
    const user = getUser();
    const isAnyAdmin = (user?.role === 'admin' || user?.isGlobal || !!localStorage.getItem('adminToken'));
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);

    const handleLogout = () => {
        logout();
    };

    return (
        <aside className="dashboard-sidebar">
            <div className="sidebar-header" style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: '1rem' }}>
                <img
                    src="/diana-logo.png"
                    alt="DIANA Logo"
                    style={{
                        width: '140px',
                        height: 'auto',
                        filter: 'drop-shadow(0 0 15px rgba(16, 185, 129, 0.5))',
                        marginBottom: '1rem'
                    }}
                />
                <h2 className="text-researcher" style={{
                    margin: 0,
                    fontSize: '1.4rem',
                    letterSpacing: '5px',
                    fontWeight: '900',
                    fontFamily: "'Orbitron', sans-serif",
                    background: 'linear-gradient(to bottom, #4ade80, #166534)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 20px rgba(74, 222, 128, 0.2)'
                }}>
                    DIANA
                </h2>
            </div>

            {user && (
                <div style={{
                    padding: '12px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--researcher-green)' }}>{user.name}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>{user.email}</div>
                </div>
            )}

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
                
                {/* API Keys: Solo per i clienti SaaS (per gestire i loro siti) */}
                {!user?.isGlobal && !localStorage.getItem('adminToken') && (
                    <button
                        className={`sidebar-link ${view === 'api_keys' ? 'active' : ''}`}
                        onClick={() => setView('api_keys')}
                        style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                        🔑 API Keys Management
                    </button>
                )}

                {/* Client Management: Solo per l'Admin globale (Tu) */}
                {isAnyAdmin && (
                    <button
                        className={`sidebar-link ${view === 'tenants' ? 'active' : ''}`}
                        onClick={() => setView('tenants')}
                        style={{
                            background: 'rgba(16, 185, 129, 0.05)',
                            border: 'none',
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderLeft: '4px solid var(--researcher-green)',
                            marginTop: '0.8rem',
                            color: 'var(--researcher-green)',
                            fontWeight: '900',
                            letterSpacing: '1px'
                        }}
                    >
                        👥 CLIENT MANAGEMENT
                    </button>
                )}

                <div className="sidebar-footer mt-2" style={{ backgroundColor: 'transparent', padding: '10px', borderTop: '1px solid var(--researcher-border)' }}>
                    <div
                        onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                            marginBottom: isFiltersExpanded ? '1rem' : '0'
                        }}
                    >
                        <small className="text-muted block" style={{ marginBottom: 0 }}>FILTERS</small>
                        <span style={{
                            color: 'var(--researcher-green)',
                            fontSize: '0.8rem',
                            transform: isFiltersExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s'
                        }}>
                            ▼
                        </span>
                    </div>

                    {isFiltersExpanded && (
                        <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
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
                    )}
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
