import React, { useState, useEffect } from 'react';
import ThreatIntelCard from './ThreatIntelCard';
import { Terminal, Shield, Loader2, Sparkles, Database, Globe, Calendar } from 'lucide-react';
import { sanitizeHTML, sanitizeData } from '../../utils/sanitizer';

const LogDetailModal = ({ log, onClose }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Reset state when log changes
    useEffect(() => {
        if (log) {
            // Se il log ha già threatIntel salvata nel DB, carichiamola
            setAnalysis(log.threatIntel || null);
            setError(null);
        }
    }, [log]);

    if (!log) return null;

    const rawPayload = JSON.stringify(log.query || {}) + JSON.stringify(log.body || {});
    const hasPayload = rawPayload.length > 5; // Stringify di {} è {} (2 chars)

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/ai/decode-payload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': localStorage.getItem('adminToken'),
                },
                body: JSON.stringify({ payload: rawPayload, mode: 'full' }),
            });

            if (!response.ok) throw new Error('AI Analysis failed');

            const data = await response.json();
            setAnalysis(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(2, 6, 23, 0.95)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 3000,
            backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                width: '95%',
                maxWidth: '1100px',
                maxHeight: '90vh',
                overflowY: 'auto',
                background: '#0f172a',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(30, 41, 59, 0.4)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            padding: '8px',
                            background: log.riskScore > 70 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '8px',
                            color: log.riskScore > 70 ? '#ef4444' : '#10b981'
                        }}>
                            <Shield size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 700 }}>
                                <span style={{ color: '#94a3b8', marginRight: '8px' }}>{sanitizeHTML(log.method)}</span>
                                {sanitizeHTML(log.path)}
                            </h2>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={12} /> {new Date(log.timestamp).toLocaleString()}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Globe size={12} /> {sanitizeHTML(log.ipAddress)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(148, 163, 184, 0.1)',
                            border: 'none',
                            color: '#94a3b8',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Content */}
                <div style={{ padding: '24px' }}>
                    {/* Intelligence Section (Always Priority) */}
                    {analysis ? (
                        <div style={{ marginBottom: '24px' }}>
                            <ThreatIntelCard intel={analysis} rawPayload={rawPayload} />
                        </div>
                    ) : hasPayload && !loading && (
                        <div style={{
                            marginBottom: '24px',
                            padding: '24px',
                            background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1), rgba(168, 85, 247, 0.1))',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            borderRadius: '12px',
                            textAlign: 'center'
                        }}>
                            <div style={{ color: '#c084fc', marginBottom: '12px' }}>
                                <Sparkles size={32} style={{ margin: '0 auto' }} />
                            </div>
                            <h3 style={{ margin: '0 0 8px 0', color: '#e2e8f0' }}>Analyze this payload with AI?</h3>
                            <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                                Our threat intelligence engine can de-obfuscate this request, extract IOCs, and explain the attacker's intent.
                            </p>
                            <button
                                onClick={handleAnalyze}
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    margin: '0 auto'
                                }}
                            >
                                <Terminal size={16} /> Run AI Investigation
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                            <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px', color: '#a855f7' }} />
                            <p style={{ fontWeight: 600 }}>Deep-scanning payload...</p>
                            <span style={{ fontSize: '0.8rem' }}>De-obfuscating scripts and extracting indicators</span>
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: '12px', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                            Error: {error}
                        </div>
                    )}

                    {/* Data Grids */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                <Database size={14} /> Request Body
                            </div>
                            <div style={{
                                background: '#020617',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: '#6ee7b7',
                                fontFamily: '"Fira Code", monospace',
                                fontSize: '0.85rem',
                                minHeight: '150px',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                overflowY: 'auto'
                            }}>
                                {typeof log.body === 'string' ? sanitizeHTML(log.body) : JSON.stringify(sanitizeData(log.body), null, 2)}
                            </div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                <Shield size={14} /> HTTP Headers
                            </div>
                            <div style={{
                                background: '#020617',
                                padding: '16px',
                                borderRadius: '12px',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                color: '#94a3b8',
                                fontFamily: '"Fira Code", monospace',
                                fontSize: '0.8rem',
                                minHeight: '150px',
                                whiteSpace: 'pre-wrap',
                                overflowY: 'auto'
                            }}>
                                {JSON.stringify(sanitizeData(log.headers), null, 2)}
                            </div>
                        </div>
                    </div>

                    {/* Query Params (if exist) */}
                    {Object.keys(log.query || {}).length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                <Globe size={14} /> Query Parameters
                            </div>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                background: 'rgba(15, 23, 42, 0.4)',
                                padding: '12px',
                                borderRadius: '8px'
                            }}>
                                {Object.entries(log.query).map(([key, val]) => (
                                    <div key={key} style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                        <span style={{ color: '#a855f7', fontWeight: 700, fontSize: '0.8rem' }}>{key}:</span>
                                        <span style={{ color: '#e2e8f0', fontSize: '0.8rem', marginLeft: '6px' }}>{String(val)}</span>
                                    </div>
                                ))}
                            </div>
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

export default LogDetailModal;
