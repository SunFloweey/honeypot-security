import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import RecentLogsTable from './RecentLogsTable';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#ef4444'];

const DashboardOverview = ({ stats, logs, riskFilter, onInvestigateLog }) => {
    return (
        <>
            <header className="mb-2">
                <h1>Research Dashboard</h1>
                <p className="text-muted">Attività globale nelle ultime 24 ore</p>
            </header>

            <div className="grid-adaptive mb-2">
                <div className="card terminal-card">
                    <small className="text-muted font-bold">TOTAL REQUESTS (24h)</small>
                    <div className="mt-1 font-h1 font-bold text-researcher">{stats?.summary?.totalLogs}</div>
                </div>
                <div className="card terminal-card">
                    <small className="text-muted font-bold">UNIQUE SESSIONS</small>
                    <div className="mt-1 font-h1 font-bold">{stats?.summary?.totalSessions}</div>
                </div>
            </div>

            {/* Traffic Trend Chart (Line Chart) */}
            <section className="mb-2">
                <h3 className="mb-1" style={{ color: 'white' }}>Traffic Trend (24h)</h3>
                <div className="card terminal-card" style={{ height: '250px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats?.timeSeries || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 12 }} />
                            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                                itemStyle={{ color: '#f8fafc' }}
                            />
                            <Area type="monotone" dataKey="requests" stroke="#10b981" fillOpacity={1} fill="url(#colorRequests)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <div className="grid-2-col mb-2">
                <section>
                    <h3 className="mb-1" style={{ color: 'white' }}>Attack Distribution</h3>
                    <div className="card terminal-card" style={{ height: '300px' }}>
                        {stats?.attacks && stats.attacks.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.attacks}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="count"
                                        nameKey="category"
                                    >
                                        {stats.attacks.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--researcher-sidebar)', border: '1px solid var(--researcher-border)' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex-center h-full text-muted">No attack data yet</div>
                        )}
                    </div>
                </section>

                <section>
                    <h3 className="mb-1" style={{ color: 'white' }}>Top Source IPs</h3>
                    <div className="card terminal-card" style={{ padding: '0', height: '300px', overflowY: 'auto' }}>
                        {stats?.topIPs?.map(ip => (
                            <div key={ip.ipAddress} className="sidebar-link" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--researcher-border)', borderRadius: '0' }}>
                                <span className="monospace text-researcher">{ip.ipAddress}</span>
                                <strong>{ip.count} reqs</strong>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <RecentLogsTable
                logs={logs}
                riskFilter={riskFilter}
                onInvestigate={(log) => onInvestigateLog(log)}
            />
        </>
    );
};

export default DashboardOverview;
