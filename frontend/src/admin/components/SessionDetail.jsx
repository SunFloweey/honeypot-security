import React, { useState } from 'react';
import ThreatIntelCard from './ThreatIntelCard';
import { ChevronRight, ShieldAlert, Cpu, Activity, Clock, Terminal, FastForward, Target } from 'lucide-react';
import { sanitizeHTML } from '../../utils/sanitizer';

const SessionDetail = ({ viewData, onBack, onSelectLog }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [expandedIntel, setExpandedIntel] = useState({});

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/ai/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': localStorage.getItem('adminToken')
                },
                body: JSON.stringify({ sessionKey: viewData.sessionKey })
            });

            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();
            setAnalysis(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleIntel = (id, e) => {
        e.stopPropagation(); // Evita di aprire il modal del log
        setExpandedIntel(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (!viewData) return null;

    return (
        <div style={{ padding: '0 20px 40px' }}>
            {/* Header Area */}
            <header style={{ marginBottom: '32px' }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        padding: '0 0 16px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> Back to Overview
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', color: '#f1f5f9', fontWeight: 800 }}>
                            Forensic Investigation Pipeline
                        </h1>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '8px', color: '#94a3b8', fontSize: '0.9rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={16} /> Session: <span style={{ color: '#c084fc', fontWeight: 700, fontFamily: 'monospace' }}>{sanitizeHTML(viewData.sessionKey.substring(0, 12))}...</span></span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldAlert size={16} /> IP: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{sanitizeHTML(viewData.ipAddress)}</span></span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16} /> Requests: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{viewData.requestCount}</span></span>
                        </div>
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={loading}
                        style={{
                            background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '10px',
                            fontWeight: 800,
                            cursor: loading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            boxShadow: '0 10px 15px -3px rgba(124, 58, 237, 0.3)',
                            transition: 'transform 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        {loading ? 'Processing...' : <><Cpu size={18} /> Deep Session Analysis</>}
                    </button>
                </div>

                {error && <div className="alert alert-danger" style={{ marginTop: '20px' }}>{error}</div>}

                {/* AI Session Analysis Result */}
                {analysis && (
                    <div style={{
                        marginTop: '32px',
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(124, 58, 237, 0.4)',
                        borderRadius: '16px',
                        padding: '24px',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%)', pointerEvents: 'none' }}></div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Terminal size={20} /> AI INVESTIGATION REPORT
                            </h3>
                            <div style={{
                                background: analysis.riskScore > 7 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                color: analysis.riskScore > 7 ? '#f87171' : '#4ade80',
                                padding: '6px 16px',
                                borderRadius: '99px',
                                fontSize: '0.85rem',
                                fontWeight: 900,
                                border: '1px solid currentColor'
                            }}>
                                AGGREGATED RISK: {analysis.riskScore || 0}/10
                            </div>
                        </div>

                        <p style={{ color: '#e2e8f0', fontSize: '1.05rem', lineHeight: 1.6, margin: '0 0 24px 0' }}>{analysis.narrative}</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Attacker Level</span>
                                <span style={{ color: '#f8fafc', fontWeight: 700 }}>{analysis.profile?.skillLevel || 'Unknown'}</span>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Tools Detected</span>
                                <span style={{ color: '#f8fafc', fontWeight: 700 }}>{analysis.profile?.tools || 'None'}</span>
                            </div>
                            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Primary Intent</span>
                                <span style={{ color: '#f8fafc', fontWeight: 700 }}>{analysis.profile?.intent || 'Reconnaissance'}</span>
                            </div>
                        </div>

                        {/* Predictive Intelligence Area */}
                        <div style={{
                            background: 'rgba(124, 58, 237, 0.05)',
                            border: '1px dashed rgba(124, 58, 237, 0.3)',
                            padding: '20px',
                            borderRadius: '12px'
                        }}>
                            <h4 style={{ margin: '0 0 16px 0', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                                <FastForward size={18} /> PREDICTIVE FORECASTING
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>Likely Next Step</span>
                                    <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem' }}>{analysis.predictions?.nextMove}</p>
                                </div>
                                <div>
                                    <span style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>Estimated Target</span>
                                    <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem' }}>{analysis.predictions?.finalObjective}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Timeline Area */}
            <div style={{ position: 'relative', paddingLeft: '40px' }}>
                <div style={{ position: 'absolute', left: '19px', top: 0, bottom: 0, width: '2px', background: 'linear-gradient(to bottom, #7c3aed 0%, rgba(124, 58, 237, 0.1) 100%)' }}></div>

                {viewData.Logs?.map((log) => (
                    <div key={log.id} style={{ position: 'relative', marginBottom: '24px' }}>
                        {/* Timeline Marker */}
                        <div style={{
                            position: 'absolute',
                            left: '-26px',
                            top: '12px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: log.riskScore > 70 ? '#ef4444' : log.riskScore > 30 ? '#f59e0b' : '#10b981',
                            border: '4px solid #0f172a',
                            zIndex: 2,
                            boxShadow: `0 0 10px ${log.riskScore > 70 ? '#ef444460' : '#10b98160'}`
                        }}></div>

                        {/* Log Card */}
                        <div
                            onClick={() => onSelectLog(log)}
                            style={{
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                                e.currentTarget.style.transform = 'translateX(4px)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.1)';
                                e.currentTarget.style.transform = 'translateX(0)';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        background: 'rgba(148, 163, 184, 0.1)',
                                        borderRadius: '4px',
                                        color: '#cbd5e1',
                                        fontWeight: 800,
                                        fontSize: '0.75rem',
                                        fontFamily: 'monospace'
                                    }}>
                                        {sanitizeHTML(log.method)}
                                    </span>
                                    <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.95rem' }}>{sanitizeHTML(log.path)}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {log.threatIntel && (
                                        <button
                                            onClick={(e) => toggleIntel(log.id, e)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                background: 'rgba(168, 85, 247, 0.15)',
                                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                                color: '#c084fc',
                                                fontSize: '0.65rem',
                                                fontWeight: 800,
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Target size={12} /> {expandedIntel[log.id] ? 'HIDE INTEL' : 'SHOW INTEL'}
                                        </button>
                                    )}
                                    <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {log.Classifications?.map(c => (
                                    <span key={c.id} style={{
                                        fontSize: '0.65rem',
                                        padding: '2px 8px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#f87171',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        fontWeight: 700
                                    }}>
                                        {sanitizeHTML(c.category)} (+{c.riskScore})
                                    </span>
                                ))}
                                <span style={{ fontSize: '0.65rem', padding: '2px 8px', background: 'rgba(30, 41, 59, 1)', color: '#94a3b8', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                    Status: {log.statusCode}
                                </span>
                            </div>

                            {/* ThreatIntelCard - Expanded inline */}
                            {log.threatIntel && expandedIntel[log.id] && (
                                <div style={{ marginTop: '16px' }} onClick={e => e.stopPropagation()}>
                                    <ThreatIntelCard
                                        intel={log.threatIntel}
                                        rawPayload={JSON.stringify(log.query || {}) + JSON.stringify(log.body || {})}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SessionDetail;
