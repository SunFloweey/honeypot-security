import React from 'react';
import { useNavigate } from 'react-router-dom';

const DashboardSidebar = ({ view, setView, refreshData, riskFilter, setRiskFilter }) => {
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
