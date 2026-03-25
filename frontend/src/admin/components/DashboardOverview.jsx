import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import RecentLogsTable from './RecentLogsTable';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#ef4444'];

const DashboardOverview = ({ stats, logs, totalLogs, currentPage, onPageChange, riskFilter, onInvestigateLog, onFilterIP, onFilterFingerprint, order, onToggleOrder, liveAnalysis }) => {
    return (
        <>
            <header className="mb-2">
                <h1>Centro di Controllo Sicurezza</h1>
                <p className="text-muted">Panoramica completa delle minacce e attività di difesa</p>
            </header>

            <div className="grid-adaptive mb-2">
                {(!totalLogs || totalLogs === 0) && (
                    <div className="card terminal-card" style={{
                        gridColumn: '1 / -1',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        padding: '2rem',
                        textAlign: 'center',
                        animation: 'fadeIn 0.5s ease-out'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
                        <h2 style={{ color: 'var(--researcher-green)', marginBottom: '1rem' }}>Benvenuto in DIANA</h2>
                        <p style={{ maxWidth: '600px', margin: '0 auto', color: '#94a3b8', lineHeight: '1.6' }}>
                            Il tuo centro di controllo è pronto. È normale che non ci siano ancora attività rilevate se i sistemi di difesa sono stati appena attivati!
                        </p>
                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ color: 'var(--researcher-green)', fontWeight: 'bold' }}>1. Create an API Key</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Go to API Keys section</div>
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ color: 'var(--researcher-green)', fontWeight: 'bold' }}>2. Install the SDK</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Protect your apps</div>
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ color: 'var(--researcher-green)', fontWeight: 'bold' }}>3. View Live Attacks</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Watch hackers in real-time</div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="card terminal-card">
                    <small className="text-muted font-bold">RICHIESTE TOTALI</small>
                    <div className="mt-1 font-h1 font-bold text-researcher">{stats?.summary?.totalLogs}</div>
                    <div className="mt-1 font-tiny text-muted" style={{ fontSize: '0.7rem' }}>Tutti gli accessi rilevati</div>
                </div>
                <div className="card terminal-card">
                    <small className="text-muted font-bold">SESSIONI UNICHE</small>
                    <div className="mt-1 font-h1 font-bold">{stats?.summary?.totalSessions}</div>
                    <div className="mt-1 font-tiny text-muted" style={{ fontSize: '0.7rem' }}>Visitatori distinti</div>
                </div>

                {/* Live AI Analysis Card */}
                <div className="card terminal-card" style={{
                    borderLeft: `4px solid ${liveAnalysis?.level === 'Critical' ? '#ef4444' :
                        liveAnalysis?.level === 'High' ? '#f97316' :
                            liveAnalysis?.level === 'Medium' ? '#eab308' : '#10b981'
                        }`,
                    minWidth: '250px'
                }}>
                    <div className="flex justify-between items-start">
                        <small className="text-muted font-bold">ANALISI MINACCE</small>
                        {liveAnalysis && (
                            <span className="font-tiny" style={{
                                padding: '2px 6px',
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                color: liveAnalysis.isBot ? '#94a3b8' : '#10b981'
                            }}>
                                {liveAnalysis.isBot ? '🤖 AUTOMATICO' : '👤 UMANO'}
                            </span>
                        )}
                    </div>
                    <div className="mt-1 font-bold" style={{
                        fontSize: '1.1rem',
                        color: liveAnalysis ? '#fff' : '#475569',
                        lineHeight: '1.2'
                    }}>
                        {liveAnalysis ? liveAnalysis.intent : 'Waiting for activity...'}
                    </div>
                    {liveAnalysis && (
                        <div className="mt-1 font-tiny text-muted">
                            Pericolo: <span style={{ color: liveAnalysis.riskScore > 7 ? '#ef4444' : '#fff' }}>{liveAnalysis.riskScore}/10</span>
                            {liveAnalysis.isHumanAlert && <span className="ml-1" style={{ color: '#ef4444' }}>⚠️ COMPORTAMENTO SOSPETTO</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Traffic Trend Chart (Line Chart) */}
            <section className="mb-2">
                <h3 className="mb-1" style={{ color: 'white' }}>Andamento Traffico</h3>
                <div className="card terminal-card" style={{ height: '250px', minHeight: '250px', position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={200} debounce={50}>
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
                    <h3 className="mb-1" style={{ color: 'white' }}>Tipi di Attacco</h3>
                    <div className="card terminal-card" style={{ height: '300px', minHeight: '300px', position: 'relative' }}>
                        {stats?.attacks && stats.attacks.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={250} debounce={50}>
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
                    <h3 className="mb-1" style={{ color: 'white' }}>Dispositivi Rilevati</h3>
                    <div className="card terminal-card" style={{ padding: '0', height: '300px', overflowY: 'auto' }}>
                        {stats?.topFingerprints && stats.topFingerprints.length > 0 ? (
                            stats.topFingerprints.map(fp => (
                                <div
                                    key={fp.fingerprint}
                                    className="sidebar-link hover-item"
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        borderBottom: '1px solid var(--researcher-border)',
                                        borderRadius: '0',
                                        cursor: 'pointer',
                                        padding: '12px'
                                    }}
                                    onClick={() => onFilterFingerprint(fp.fingerprint)}
                                    title="Click to track this device"
                                >
                                    <div>
                                        <span className="monospace" style={{ color: '#a78bfa' }}>{fp.fingerprint.substring(0, 12)}...</span>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Last seen: {new Date(fp.lastSeen).toLocaleTimeString()}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold' }}>{fp.uniqueIPs} IPs used</div>
                                        <div style={{ fontSize: '0.7rem' }}>{fp.totalRequests} total reqs</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex-center h-full text-muted">No fingerprint data yet</div>
                        )}
                    </div>
                </section>
            </div>

            <RecentLogsTable
                logs={logs}
                totalLogs={totalLogs || logs.length}
                currentPage={currentPage || 1}
                onPageChange={onPageChange}
                riskFilter={riskFilter}
                onInvestigate={(log) => onInvestigateLog(log)}
                onFilterIP={onFilterIP}
                onFilterFingerprint={onFilterFingerprint}
                limit={50}
                order={order}
                onToggleOrder={onToggleOrder}
            />
        </>
    );
};

export default DashboardOverview;
