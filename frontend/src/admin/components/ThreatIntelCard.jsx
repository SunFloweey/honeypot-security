import React, { useState } from 'react';
import { ShieldAlert, Terminal, Unlock, Globe, AlertTriangle, Layers, Target, User, ChevronDown, ChevronUp, ExternalLink, FileWarning, Mail, Server } from 'lucide-react';
import { sanitizeHTML } from '../../utils/sanitizer';

const ThreatIntelCard = ({ intel, rawPayload }) => {
    const [showRaw, setShowRaw] = useState(false);
    const [expandedSections, setExpandedSections] = useState({ indicators: true, encoding: false });

    if (!intel) return null;

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const riskColor = intel.risk_level > 7 ? '#ef4444' : intel.risk_level > 4 ? '#f59e0b' : '#22c55e';
    const riskBg = intel.risk_level > 7 ? 'rgba(239,68,68,0.15)' : intel.risk_level > 4 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)';

    return (
        <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            borderLeft: `4px solid ${riskColor}`,
            borderRadius: '0 12px 12px 0',
            padding: '24px',
            margin: '16px 0',
            boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 40px ${riskColor}20`,
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldAlert style={{ color: riskColor }} size={24} />
                    <h3 style={{
                        color: '#fff',
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        margin: 0,
                    }}>
                        AI Threat Intelligence Report
                    </h3>
                    {intel.analysis_source && (
                        <span style={{
                            fontSize: '0.65rem',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            background: intel.analysis_source === 'hybrid' ? 'rgba(168,85,247,0.3)' : 'rgba(100,116,139,0.3)',
                            color: intel.analysis_source === 'hybrid' ? '#c084fc' : '#94a3b8',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                        }}>
                            {intel.analysis_source === 'hybrid' ? '🤖 AI + Local' : '⚡ Local Only'}
                        </span>
                    )}
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <span style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        background: riskBg,
                        color: riskColor,
                        border: `1px solid ${riskColor}40`,
                        animation: intel.risk_level > 7 ? 'pulse 2s infinite' : 'none',
                    }}>
                        RISK: {intel.risk_level}/10
                    </span>
                </div>
            </div>

            {/* Technique + MITRE ATT&CK */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px',
                flexWrap: 'wrap',
            }}>
                <div style={{
                    flex: '1 1 200px',
                    background: 'rgba(15,23,42,0.6)',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(148,163,184,0.1)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                        <span style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>
                            Attack Technique
                        </span>
                    </div>
                    <div style={{ color: '#f87171', fontFamily: 'monospace', fontWeight: 700, fontSize: '1.05rem' }}>
                        {intel.technique || "Unknown Malicious Activity"}
                    </div>
                </div>

                {intel.mitre_id && (
                    <div style={{
                        flex: '0 0 auto',
                        background: 'rgba(168,85,247,0.1)',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid rgba(168,85,247,0.2)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <Target size={14} style={{ color: '#a855f7' }} />
                            <span style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>
                                MITRE ATT&CK
                            </span>
                        </div>
                        <a
                            href={`https://attack.mitre.org/techniques/${intel.mitre_id?.replace('.', '/')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: '#c084fc',
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '1rem',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                            }}
                        >
                            {intel.mitre_id} <ExternalLink size={12} />
                        </a>
                    </div>
                )}

                {intel.attacker_profile && (
                    <div style={{
                        flex: '0 0 auto',
                        background: 'rgba(239,68,68,0.1)',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid rgba(239,68,68,0.2)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <User size={14} style={{ color: '#ef4444' }} />
                            <span style={{ color: '#94a3b8', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>
                                Attacker Profile
                            </span>
                        </div>
                        <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.95rem', textTransform: 'capitalize' }}>
                            {intel.attacker_profile?.replace(/_/g, ' ')}
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                marginBottom: '16px',
            }}>
                {/* Decoded Script */}
                <div style={{
                    background: '#000',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(16,185,129,0.2)',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#10b981',
                        marginBottom: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                    }}>
                        <Unlock size={16} /> Decoded Payload (Cleartext)
                    </div>
                    <pre style={{
                        color: '#6ee7b7',
                        fontFamily: '"Fira Code", "Cascadia Code", monospace',
                        fontSize: '0.82rem',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        margin: 0,
                        lineHeight: 1.6,
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}>
                        {intel.decoded_script || "No script extracted."}
                    </pre>
                </div>

                {/* AI Explanation */}
                <div style={{
                    background: 'rgba(30,41,59,0.6)',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(148,163,184,0.1)',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#60a5fa',
                        marginBottom: '10px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                    }}>
                        <Terminal size={16} /> AI Explanation
                    </div>
                    <p style={{
                        color: '#cbd5e1',
                        fontSize: '0.85rem',
                        lineHeight: 1.65,
                        fontStyle: 'italic',
                        margin: 0,
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}>
                        "{intel.explanation || 'Analysis pending...'}"
                    </p>
                </div>
            </div>

            {/* Encoding Layers (Collapsible) */}
            {intel.encoding_layers?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <button
                        onClick={() => toggleSection('encoding')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(168,85,247,0.1)',
                            border: '1px solid rgba(168,85,247,0.2)',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            color: '#c084fc',
                            cursor: 'pointer',
                            width: '100%',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                        }}
                    >
                        <Layers size={16} />
                        Encoding Layers ({intel.encoding_layers.length})
                        {expandedSections.encoding ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedSections.encoding && (
                        <div style={{
                            marginTop: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                        }}>
                            {intel.encoding_layers.map((layer, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    background: 'rgba(168,85,247,0.05)',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(168,85,247,0.1)',
                                }}>
                                    <span style={{
                                        background: 'rgba(168,85,247,0.3)',
                                        color: '#e9d5ff',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        minWidth: '20px',
                                        textAlign: 'center',
                                    }}>
                                        L{idx + 1}
                                    </span>
                                    <div>
                                        <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600 }}>
                                            {layer.type}
                                        </span>
                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '8px' }}>
                                            ({layer.encoding})
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Network Indicators (IoC) */}
            {(intel.indicators?.ips?.length > 0 ||
                intel.indicators?.domains?.length > 0 ||
                intel.indicators?.urls?.length > 0 ||
                intel.indicators?.files?.length > 0 ||
                intel.indicators?.emails?.length > 0) && (
                    <div style={{
                        padding: '14px',
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        borderRadius: '8px',
                        marginBottom: '16px',
                    }}>
                        <div style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#f87171',
                            textTransform: 'uppercase',
                            marginBottom: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}>
                            <AlertTriangle size={14} /> Indicators of Compromise (IoC)
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {intel.indicators.ips?.map(ip => (
                                <span key={ip} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(239,68,68,0.2)',
                                    color: '#fca5a5',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                    fontWeight: 600,
                                }}>
                                    <Server size={11} /> {sanitizeHTML(ip)}
                                </span>
                            ))}
                            {intel.indicators.domains?.map(d => (
                                <span key={d} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(239,68,68,0.15)',
                                    color: '#fecaca',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                }}>
                                    <Globe size={11} /> {sanitizeHTML(d)}
                                </span>
                            ))}
                            {intel.indicators.urls?.map(url => (
                                <span key={url} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(251,146,60,0.15)',
                                    color: '#fdba74',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                    maxWidth: '300px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    <ExternalLink size={11} /> {sanitizeHTML(url)}
                                </span>
                            ))}
                            {intel.indicators.files?.map(f => (
                                <span key={f} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(245,158,11,0.15)',
                                    color: '#fcd34d',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                }}>
                                    <FileWarning size={11} /> {sanitizeHTML(f)}
                                </span>
                            ))}
                            {intel.indicators.emails?.map(e => (
                                <span key={e} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(59,130,246,0.15)',
                                    color: '#93c5fd',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                }}>
                                    <Mail size={11} /> {sanitizeHTML(e)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

            {/* Recommended Action */}
            {intel.recommended_action && (
                <div style={{
                    padding: '12px 16px',
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                }}>
                    <span style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        🛡️ Recommended Action:
                    </span>
                    <span style={{ color: '#bbf7d0', fontSize: '0.85rem', marginLeft: '8px' }}>
                        {intel.recommended_action}
                    </span>
                </div>
            )}

            {/* Toggle Original Payload */}
            <button
                onClick={() => setShowRaw(!showRaw)}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    transition: 'color 0.2s',
                }}
                onMouseEnter={e => e.target.style.color = '#cbd5e1'}
                onMouseLeave={e => e.target.style.color = '#64748b'}
            >
                {showRaw ? "Hide Original Payload" : "Show Original Obfuscated Payload"}
            </button>

            {showRaw && (
                <div style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: '#020617',
                    borderRadius: '6px',
                    fontSize: '0.65rem',
                    fontFamily: 'monospace',
                    color: '#475569',
                    wordBreak: 'break-all',
                    border: '1px solid rgba(51,65,85,0.3)',
                    maxHeight: '120px',
                    overflowY: 'auto',
                }}>
                    {sanitizeHTML(rawPayload)}
                </div>
            )}
        </div>
    );
};

export default ThreatIntelCard;