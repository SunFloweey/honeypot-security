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
    topFingerprints = []
}) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        navigate('/researcher-login');
    };

    return (
        <aside className="dashboard-sidebar">
            <h2 className="text-researcher" style={{ marginBottom: '2rem', fontSize: '1rem' }}>🛡️ HONEYPOT ANALYTICS</h2>

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
                    Recent Logs
                </button>

                <div className="sidebar-footer mt-2" style={{ backgroundColor: 'transparent', padding: '10px', borderTop: '1px solid var(--researcher-border)' }}>
                    <small className="text-muted block mb-1">FILTERS</small>

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

                    {/* Fingerprint Intelligence (NEW!) */}
                    <div className="mb-1">
                        <label className="font-tiny text-muted block mb-1">Browser Intel (Multi-IP):</label>
                        <select
                            value={fingerprintFilter}
                            onChange={(e) => { setFingerprintFilter(e.target.value); setIpFilter(''); }}
                            className="w-full monospace"
                            style={{
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid var(--researcher-border)',
                                color: '#a78bfa', // Purple color for intelligence
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
                        {(ipFilter || fingerprintFilter) && (
                            <button
                                onClick={() => { setIpFilter(''); setFingerprintFilter(''); }}
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
                                ✕ Clear Filters
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
