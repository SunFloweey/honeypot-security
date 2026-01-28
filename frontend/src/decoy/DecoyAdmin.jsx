import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CONFIG from '../config';

// Pannello admin esca che sembra permettere di cambiare i permessi degli utenti o 
// vedere i log di sistema finti
const DecoyAdmin = () => {
    const [stats, setStats] = useState({
        requests: 0,
        threats: 0,
        uptime: CONFIG.BAIT.UPTIME,
        lastAttack: 'None detected'
    });

    useEffect(() => {
        let timeoutId;

        const updateStats = () => {
            setStats(prev => ({
                ...prev,
                requests: prev.requests + Math.floor(Math.random() * 5)
            }));

            // Randomize next update based on config
            const delay = CONFIG.TIMING.STATS_UPDATE_MIN + Math.random() * (CONFIG.TIMING.STATS_UPDATE_MAX - CONFIG.TIMING.STATS_UPDATE_MIN);
            timeoutId = setTimeout(updateStats, delay);
        };

        updateStats();
        return () => clearTimeout(timeoutId);
    }, []);

    return (
        <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className="dashboard-sidebar">
                <div className="sidebar-logo-container">
                    <div className="nav-logo">{CONFIG.BRAND.LOGO_LETTER}</div>
                    <span className="font-bold">{CONFIG.BRAND.NAME}</span>
                </div>

                <nav className="sidebar-nav">
                    <Link to="/admin" className="sidebar-link active">Dashboard</Link>
                    <Link to="/admin/servers" className="sidebar-link">Server Management</Link>
                    <Link to="/admin/users" className="sidebar-link">User Access Control</Link>
                    <Link to="/admin/logs" className="sidebar-link">Security Logs</Link>
                    <Link to="/upload" className="sidebar-link">Asset Deployment</Link>
                </nav>

                <div className="sidebar-footer mt-auto">
                    <p className="font-tiny text-muted mb-0">LOGGED AS</p>
                    <p className="font-small font-bold">it-admin@{CONFIG.BRAND.NAME.toLowerCase().replace(/\s/g, '')}.com</p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="dashboard-main">
                <header className="flex justify-between items-center mb-2">
                    <div>
                        <h1 className="mb-0">Infrastructure Control Panel</h1>
                        <p className="text-muted font-small">Real-time monitoring of {CONFIG.BRAND.SHORT_NAME} internal nodes</p>
                    </div>
                    <button className="secondary">Refresh Data</button>
                </header>

                <div className="grid-adaptive">
                    <div className="card">
                        <small className="text-muted font-bold">TOTAL NODES</small>
                        <div className="mt-1 font-h2 font-bold">42</div>
                    </div>
                    <div className="card">
                        <small className="text-muted font-bold">HTTP REQUESTS</small>
                        <div className="mt-1 font-h2 font-bold">{stats.requests.toLocaleString()}</div>
                    </div>
                    <div className="card">
                        <small className="text-muted font-bold">SECURITY EVENTS</small>
                        <div className="mt-1 font-h2 font-bold text-danger">12</div>
                    </div>
                    <div className="card">
                        <small className="text-muted font-bold">UPTIME</small>
                        <div className="mt-1 font-h2 font-bold text-success">{stats.uptime}</div>
                    </div>
                </div>

                <div className="grid-2-col">
                    <section className="card p-0">
                        <div className="standard-container" style={{ padding: '1.5rem', width: 'auto' }}>
                            <h3 className="mb-0">Critical Server Objects</h3>
                        </div>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>SERVICE NAME</th>
                                        <th>VERSION</th>
                                        <th>IP ADDRESS</th>
                                        <th>LOAD</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="font-semibold">Authentication Service</td>
                                        <td className="text-muted">{CONFIG.BAIT.LEGACY_VERSION}</td>
                                        <td className="monospace">10.0.4.155</td>
                                        <td className="text-success">Good</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">DB Gateway (MySQL)</td>
                                        <td className="text-muted">{CONFIG.BAIT.DATABASE_VERSION}</td>
                                        <td className="monospace">10.0.4.12</td>
                                        <td>45%</td>
                                    </tr>
                                    <tr>
                                        <td className="font-semibold">Internal Backup Engine</td>
                                        <td className="text-muted">v2.4.1</td>
                                        <td className="monospace">10.0.4.200</td>
                                        <td>92%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <aside className="card terminal-card">
                        <h3 className="mb-2" style={{ color: 'white' }}>Terminal Audit</h3>
                        <div className="terminal-view">
                            <p className="terminal-line terminal-success">[SYSTEM] Authenticated as admin</p>
                            <p className="terminal-line terminal-info">[INFO] Checking integrity scan...</p>
                            <p className="terminal-line terminal-warn">[WARN] Legacy DB (10.0.4.12) is reaching quota</p>
                            <p className="terminal-line terminal-info">[AUDIT] 5 login failures monitored from external IP</p>
                            <p className="terminal-line terminal-success">{'>'} _</p>
                        </div>
                    </aside>
                </div>
            </main>
        </div>
    );
};

export default DecoyAdmin;
