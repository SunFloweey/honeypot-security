import React, { useState, useEffect } from 'react';
import { Terminal, Users, Clock, Hash, ChevronRight, Activity, Shield, AlertTriangle, Search, Trash2 } from 'lucide-react';
import { sanitizeHTML } from '../../utils/sanitizer';

const TerminalMonitor = () => {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [forensics, setForensics] = useState(null);
    const [loading, setLoading] = useState(false);
    const refreshInterval = 5000;

    const fetchSessions = async () => {
        try {
            const response = await fetch('/admin/terminal/sessions', {
                headers: { 'x-admin-token': localStorage.getItem('adminToken') }
            });
            const data = await response.json();
            setSessions(data.activeSessions || []);
        } catch (error) {
            console.error('Error fetching terminal sessions:', error);
        }
    };

    const fetchForensics = async (key) => {
        setLoading(true);
        try {
            const response = await fetch(`/admin/terminal/session/${key}`, {
                headers: { 'x-admin-token': localStorage.getItem('adminToken') }
            });
            const data = await response.json();
            setForensics(data);
        } catch (error) {
            console.error('Error fetching forensics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, refreshInterval);
        return () => clearInterval(interval);
    }, [refreshInterval]);

    const handleSelectSession = (session) => {
        setSelectedSession(session);
        fetchForensics(session.sessionKey);
    };

    return (
        <div style={{ padding: '24px', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Terminal size={32} color="#a855f7" />
                        Virtual Shell Monitor
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8' }}>
                        Real-time inspection of AI-powered terminal hallucinations.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ background: '#1e293b', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Activity size={16} color="#10b981" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{sessions.length} Active Sessions</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px' }}>
                {/* Session List */}
                <div style={{ background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(30, 41, 59, 0.4)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input
                                type="text"
                                placeholder="Filter sessions..."
                                style={{ width: '100%', background: '#020617', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '8px', padding: '8px 12px 8px 36px', color: 'white', fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {sessions.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                                <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                <p>No active shell sessions</p>
                            </div>
                        ) : (
                            sessions.map((s, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSelectSession(s)}
                                    style={{
                                        padding: '16px',
                                        borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                        cursor: 'pointer',
                                        background: selectedSession?.sessionKey === s.sessionKey ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                                        borderLeft: selectedSession?.sessionKey === s.sessionKey ? '4px solid #a855f7' : '4px solid transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>{sanitizeHTML(s.user)}@{sanitizeHTML(s.persona)}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} /> {s.minutesActive}m
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace', marginBottom: '8px' }}>
                                        ID: {sanitizeHTML(s.shortKey)}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>
                                            {s.commandCount} CMDs
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            Last: <span style={{ color: '#e2e8f0' }}>{sanitizeHTML(s.lastCommand)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Forensics / History View */}
                <div style={{ background: '#0f172a', borderRadius: '16px', border: '1px solid rgba(148, 163, 184, 0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
                    {selectedSession ? (
                        <>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(148, 163, 184, 0.1)', background: 'rgba(30, 41, 59, 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                                            Session Investigation: <span style={{ color: '#a855f7' }}>{sanitizeHTML(selectedSession.user)}@{sanitizeHTML(selectedSession.persona)}</span>
                                        </h2>
                                        <span style={{ padding: '2px 10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                            ACTIVE THREAT
                                        </span>
                                    </div>
                                    <div style={{ marginTop: '4px', color: '#64748b', fontSize: '0.8rem', display: 'flex', gap: '16px' }}>
                                        <span>Started: {forensics?.createdAt ? new Date(forensics.createdAt).toLocaleString() : 'Loading...'}</span>
                                        <span>Entry Vector: {sanitizeHTML(selectedSession.entryVector || forensics?.entryVector || '/shell.php')}</span>
                                    </div>
                                </div>
                                <button style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <Trash2 size={16} /> Kill Session
                                </button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                                {loading ? (
                                    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <Activity size={40} className="animate-spin" color="#a855f7" />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                            {[
                                                { label: 'HOSTNAME', value: forensics?.hostname, icon: Hash },
                                                { label: 'WORKING DIR', value: forensics?.cwd, icon: ChevronRight },
                                                { label: 'COMMANDS', value: forensics?.commandCount, icon: Terminal },
                                                { label: 'DURATION', value: `${forensics?.durationMinutes} min`, icon: Clock },
                                            ].map((stat, i) => (
                                                <div key={i} style={{ background: 'rgba(30, 41, 59, 0.4)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.05)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
                                                        <stat.icon size={12} /> {stat.label}
                                                    </div>
                                                    <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sanitizeHTML(stat.value)}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div>
                                            <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Terminal size={16} /> Command Timeline
                                            </h3>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {forensics?.commandHistory?.length === 0 ? (
                                                    <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(30, 41, 59, 0.2)', borderRadius: '12px', border: '1px dashed rgba(148, 163, 184, 0.1)', color: '#64748b' }}>
                                                        No commands recorded yet
                                                    </div>
                                                ) : (
                                                    forensics?.commandHistory?.map((h, i) => (
                                                        <div key={i} style={{ display: 'flex', gap: '16px' }}>
                                                            <div style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace', paddingTop: '10px', width: '70px' }}>
                                                                {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                            </div>
                                                            <div style={{ flex: 1, background: '#020617', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.1)', position: 'relative' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
                                                                    <span style={{ color: '#64748b' }}>[{sanitizeHTML(h.cwd)}]</span> $ {sanitizeHTML(h.command)}
                                                                </div>
                                                                {/* Optional: we could store behavior analysis per command */}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#64748b' }}>
                            <Shield size={64} style={{ opacity: 0.1, marginBottom: '24px' }} />
                            <h2 style={{ margin: 0 }}>Select a session to investigate</h2>
                            <p style={{ margin: '8px 0 0 0' }}>Live forensics data will appear here</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default TerminalMonitor;
