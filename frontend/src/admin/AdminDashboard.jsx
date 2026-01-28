import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import CONFIG from '../config';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const navigate = useNavigate();

    const [riskFilter, setRiskFilter] = useState(0);
    const [view, setView] = useState('overview');
    const [viewData, setViewData] = useState(null);

    const getToken = () => localStorage.getItem('adminToken');

    const fetchData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        const token = getToken();

        if (!token) {
            navigate('/researcher-login');
            return;
        }

        try {
            const [statsRes, logsRes] = await Promise.all([
                fetch('/stats/overview', { headers: { 'x-admin-token': token } }),
                fetch(`/stats/logs?limit=50&risk_min=${riskFilter}`, { headers: { 'x-admin-token': token } })
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

    useEffect(() => {
        let timeoutId;

        const poll = () => {
            fetchData(true);
            const delay = CONFIG.TIMING.POLLING_MIN + Math.random() * (CONFIG.TIMING.POLLING_MAX - CONFIG.TIMING.POLLING_MIN);
            timeoutId = setTimeout(poll, delay);
        };

        fetchData(false);
        timeoutId = setTimeout(poll, 5000);

        return () => clearTimeout(timeoutId);
    }, [riskFilter]);

    const showSessionTimeline = async (sessionKey) => {
        setLoading(true);
        try {
            const res = await fetch(`/stats/session/${sessionKey}`, { headers: { 'x-admin-token': getToken() } });
            const data = await res.json();
            setViewData(data);
            setView('session');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Chart Colors
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#ef4444'];

    if (loading && !stats && view === 'overview') {
        return <div className="flex-center" style={{ backgroundColor: 'var(--researcher-bg)', color: 'var(--researcher-green)' }}>Inizializzazione Honeypot Dashboard...</div>;
    }

    return (
        <div className="dashboard-layout">
            <aside className="dashboard-sidebar">
                <h2 className="text-researcher" style={{ marginBottom: '2rem', fontSize: '1rem' }}>🛡️ HONEYPOT ANALYTICS</h2>

                <nav className="sidebar-nav">
                    <button
                        className={`sidebar-link ${view === 'overview' ? 'active' : ''}`}
                        onClick={() => { setView('overview'); fetchData(true); }}
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
                        onClick={() => { localStorage.removeItem('adminToken'); navigate('/researcher-login'); }}
                        className="sidebar-link"
                        style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                    >
                        Logout
                    </button>
                </div>
            </aside>

            <main className="dashboard-main">
                {view === 'overview' && (
                    <>
                        <header className="mb-2">
                            <h1>Research Dashboard</h1>
                            <p className="text-muted">Attività globale nelle ultime 24 ore</p>
                        </header>

                        <div className="grid-adaptive">
                            <div className="card terminal-card">
                                <small className="text-muted font-bold">TOTAL REQUESTS (24h)</small>
                                <div className="mt-1 font-h1 font-bold text-researcher">{stats?.summary?.totalLogs}</div>
                            </div>
                            <div className="card terminal-card">
                                <small className="text-muted font-bold">UNIQUE SESSIONS</small>
                                <div className="mt-1 font-h1 font-bold">{stats?.summary?.totalSessions}</div>
                            </div>
                        </div>

                        <div className="grid-2-col mb-2">
                            <section>
                                <h3 className="mb-1" style={{ color: 'white' }}>Attack Distribution</h3>
                                <div className="card terminal-card" style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats?.attacks}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                fill="#8884d8"
                                                paddingAngle={5}
                                                dataKey="count"
                                                nameKey="category"
                                            >
                                                {stats?.attacks?.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ backgroundColor: 'var(--researcher-sidebar)', border: '1px solid var(--researcher-border)' }} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </section>

                            <section>
                                <h3 className="mb-1" style={{ color: 'white' }}>Top Source IPs</h3>
                                <div className="card terminal-card" style={{ padding: '0', height: '300px', overflowY: 'auto' }}>
                                    {stats?.topIPs?.map(ip => (
                                        <div key={ip.ip_address} className="sidebar-link" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--researcher-border)', borderRadius: '0' }}>
                                            <span className="monospace text-researcher">{ip.ip_address}</span>
                                            <strong>{ip.count} reqs</strong>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        <section>
                            <h3 className="mb-1" style={{ color: 'white' }}>Live Feed (Filtered: Risk &gt; {riskFilter})</h3>
                            <div className="table-container card terminal-card" style={{ padding: 0 }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Timestamp</th>
                                            <th>Method</th>
                                            <th>Path</th>
                                            <th>IP</th>
                                            <th>Risk Score</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.slice(0, 15).map(log => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid var(--researcher-border)' }}>
                                                <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                                                <td style={{ color: '#fbbf24' }}>{log.method}</td>
                                                <td className="monospace">{log.path.substring(0, 30)}{log.path.length > 30 ? '...' : ''}</td>
                                                <td>{log.ip_address}</td>
                                                <td>
                                                    {log.Classifications?.map(c => (
                                                        <span key={c.id} className="tag tag-danger" style={{ marginRight: '5px' }}>
                                                            {c.category} ({c.risk_score})
                                                        </span>
                                                    ))}
                                                </td>
                                                <td>
                                                    <button onClick={() => { setSelectedLog(log); showSessionTimeline(log.session_key); }} className="primary" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>Investigate</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}

                {view === 'session' && viewData && (
                    <>
                        <header className="mb-2">
                            <button className="secondary mb-1" onClick={() => setView('overview')}>← Back to Overview</button>
                            <h1>Forensic Timeline</h1>
                            <p className="text-muted mb-1">Session: {viewData.session_key} | IP: {viewData.ip_address}</p>
                            <div className="flex gap-1 flex-wrap">
                                <div className="card terminal-card" style={{ padding: '8px 15px', marginBottom: 0 }}>
                                    <small className="text-muted block font-tiny">RESOLUTION</small>
                                    <div className="font-small font-bold">{viewData.screen_resolution || 'n/a'}</div>
                                </div>
                                <div className="card terminal-card" style={{ padding: '8px 15px', marginBottom: 0 }}>
                                    <small className="text-muted block font-tiny">LANGUAGE</small>
                                    <div className="font-small font-bold">{viewData.browser_language || 'n/a'}</div>
                                </div>
                                <div className="card terminal-card" style={{ padding: '8px 15px', marginBottom: 0 }}>
                                    <small className="text-muted block font-tiny">TIMEZONE</small>
                                    <div className="font-small font-bold">{viewData.timezone || 'n/a'}</div>
                                </div>
                                <div className="card terminal-card" style={{ padding: '8px 15px', marginBottom: 0 }}>
                                    <small className="text-muted block font-tiny">PLATFORM</small>
                                    <div className="font-small font-bold">{viewData.platform || 'n/a'}</div>
                                </div>
                            </div>
                        </header>

                        <div style={{ position: 'relative', paddingLeft: '40px', marginTop: '2rem' }}>
                            <div style={{ position: 'absolute', left: '19px', top: 0, bottom: 0, width: '2px', backgroundColor: 'var(--researcher-border)' }}></div>
                            {viewData.Logs?.map((log) => (
                                <div key={log.id} style={{ position: 'relative', marginBottom: '2rem' }}>
                                    <div style={{
                                        position: 'absolute',
                                        left: '-26px',
                                        top: '15px',
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        backgroundColor: log.Classifications?.length > 0 ? 'var(--danger)' : 'var(--researcher-green)',
                                    }}></div>
                                    <div className="card terminal-card" style={{ padding: '1rem', cursor: 'pointer', border: log.Classifications?.length > 0 ? '1px solid var(--danger)' : '1px solid var(--researcher-border)' }} onClick={() => setSelectedLog(log)}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold">{log.method} {log.path}</span>
                                            <span className="font-tiny text-muted">{new Date(log.timestamp).toLocaleTimeString()} ({log.response_time_ms}ms)</span>
                                        </div>
                                        <div className="flex gap-1">
                                            {log.Classifications?.map(c => (
                                                <span key={c.id} className="tag tag-danger">
                                                    {c.category} (+{c.risk_score})
                                                </span>
                                            ))}
                                            <span className="tag" style={{ backgroundColor: 'var(--researcher-sidebar)', color: 'var(--text-muted)' }}>Status: {log.status_code}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </main>

            {/* Modal Detail Overlay */}
            {selectedLog && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
                    <div className="card terminal-card" style={{ width: '90%', maxWidth: '1000px', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div className="flex justify-between items-center mb-2">
                            <h2 style={{ color: 'white' }}>Detail: {selectedLog.method} {selectedLog.path}</h2>
                            <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                        </div>
                        <div className="grid-2-col">
                            <div>
                                <h4 className="mb-1">Request Payload</h4>
                                <div className="terminal-view" style={{ height: 'auto', minHeight: '200px' }}>
                                    {typeof selectedLog.body === 'string' ? selectedLog.body : JSON.stringify(selectedLog.body, null, 2)}
                                </div>
                            </div>
                            <div>
                                <h4 className="mb-1">Audit Headers</h4>
                                <div className="terminal-view" style={{ height: 'auto', minHeight: '200px', color: 'var(--text-muted)' }}>
                                    {JSON.stringify(selectedLog.headers, null, 2)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
