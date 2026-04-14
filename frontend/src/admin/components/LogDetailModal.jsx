import React, { useState, useEffect } from 'react';
import ThreatIntelCard from './ThreatIntelCard';
import { Terminal, Shield, Loader2, Sparkles, Database, Globe, Calendar, AlertTriangle } from 'lucide-react';
import { sanitizeHTML, sanitizeData } from '../../utils/sanitizer';
import { useAdminAuth } from '../../hooks/useAdminAuth';

// Funzioni helper per formattazione payload comprensibile
const formatPayloadForHumans = (payload) => {
    if (!payload) return { formatted: 'Nessun dato', summary: 'Vuoto', suspicious: false };
    
    try {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const str = JSON.stringify(parsed);
        
        // Analizza il contenuto per capire cosa contiene
        const analysis = analyzePayload(parsed);
        
        return {
            formatted: JSON.stringify(parsed, null, 2),
            summary: analysis.summary,
            suspicious: analysis.suspicious,
            type: analysis.type,
            keyFields: analysis.keyFields
        };
    } catch (e) {
        // Se non è JSON, formatta come testo normale
        return {
            formatted: sanitizeHTML(String(payload)),
            summary: getTextSummary(String(payload)),
            suspicious: isSuspiciousText(String(payload)),
            type: 'text',
            keyFields: []
        };
    }
};

const analyzePayload = (data) => {
    const summary = [];
    const keyFields = [];
    let suspicious = false;
    let type = 'unknown';
    
    // Analizza i tipi di dati comuni
    if (data.username || data.user || data.email) {
        type = 'credentials';
        summary.push('🔑 Credenziali utente');
        keyFields.push('username', 'user', 'email', 'password');
        suspicious = true;
    }
    
    if (data.api_key || data.token || data.key) {
        type = 'api_keys';
        summary.push('🔐 Chiavi API/Token');
        keyFields.push('api_key', 'token', 'key');
        suspicious = true;
    }
    
    if (data.command || data.cmd || data.exec) {
        type = 'command';
        summary.push('⚡ Comandi eseguiti');
        keyFields.push('command', 'cmd', 'exec');
        suspicious = true;
    }
    
    if (data.sql || data.query || data.select) {
        type = 'database';
        summary.push('🗄️ Query database');
        keyFields.push('sql', 'query', 'select');
        suspicious = true;
    }
    
    if (data.file || data.upload || data.filename) {
        type = 'file_upload';
        summary.push('📁 Upload file');
        keyFields.push('file', 'upload', 'filename');
        suspicious = true;
    }
    
    // Controlla pattern sospetti
    const str = JSON.stringify(data).toLowerCase();
    if (str.includes('password') || str.includes('secret') || str.includes('admin')) {
        suspicious = true;
        summary.push('⚠️ Dati sensibili');
    }
    
    if (str.includes('union select') || str.includes('drop table') || str.includes('delete from')) {
        suspicious = true;
        summary.push('🚨 SQL Injection');
    }
    
    if (str.includes('eval(') || str.includes('system(') || str.includes('exec(')) {
        suspicious = true;
        summary.push('💥 Code Injection');
    }
    
    return {
        summary: summary.length > 0 ? summary.join(' | ') : '📄 Dati generici',
        suspicious,
        type,
        keyFields
    };
};

const getTextSummary = (text) => {
    const lower = text.toLowerCase();
    const summary = [];
    
    if (lower.includes('password') || lower.includes('secret')) {
        summary.push('🔑 Contiene credenziali');
    }
    
    if (lower.includes('admin') || lower.includes('root')) {
        summary.push('👤 Accesso privilegiato');
    }
    
    if (lower.includes('select') || lower.includes('union')) {
        summary.push('🗄️ Query SQL');
    }
    
    if (lower.includes('eval') || lower.includes('exec')) {
        summary.push('⚡ Comandi sistema');
    }
    
    return summary.length > 0 ? summary.join(' | ') : `📝 Testo (${text.length} caratteri)`;
};

const isSuspiciousText = (text) => {
    const suspicious = [
        'password', 'secret', 'admin', 'root', 'union select', 
        'drop table', 'eval(', 'system(', 'exec(', '<script',
        'javascript:', 'data:', 'vbscript:'
    ];
    
    return suspicious.some(pattern => text.toLowerCase().includes(pattern));
};

const formatHeadersForHumans = (headers) => {
    if (!headers) return { formatted: {}, summary: 'Nessun header' };
    
    const importantHeaders = {
        'user-agent': '🌐 Browser/Client',
        'authorization': '🔑 Autenticazione',
        'content-type': '📄 Tipo contenuto',
        'x-forwarded-for': '🌍 IP Proxy',
        'cookie': '🍪 Cookie sessione',
        'referer': '🔗 Provenienza'
    };
    
    const formatted = {};
    const summary = [];
    
    Object.entries(headers).forEach(([key, value]) => {
        const importantKey = importantHeaders[key.toLowerCase()];
        if (importantKey) {
            formatted[key] = value;
            summary.push(importantKey);
        } else {
            formatted[key] = value;
        }
    });
    
    return {
        formatted: JSON.stringify(formatted, null, 2),
        summary: summary.length > 0 ? summary.join(' | ') : '📋 Headers standard'
    };
};

const LogDetailModal = ({ log, onClose }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { getToken } = useAdminAuth();

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
            const token = getToken();
            const isSaaS = !!localStorage.getItem('saasToken');
            
            const headers = {
                'Content-Type': 'application/json',
                ...(isSaaS ? { 'Authorization': `Bearer ${token}` } : { 'x-admin-token': token })
            };

            const response = await fetch('/api/ai/decode-payload', {
                method: 'POST',
                headers,
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
                            <h3 style={{ margin: '0 0 8px 0', color: '#e2e8f0' }}>Analizza questa richiesta con AI?</h3>
                            <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                                Il nostro motore può analizzare questa richiesta, estrarre indicatori di minaccia e spiegare le intenzioni dell'attaccante.
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
                                <Database size={14} /> Dati Inviati
                            </div>
                            
                            {/* Summary del payload */}
                            {(() => {
                                const payloadAnalysis = formatPayloadForHumans(log.body);
                                return (
                                    <>
                                        <div style={{
                                            background: payloadAnalysis.suspicious ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            marginBottom: '8px',
                                            fontSize: '0.8rem',
                                            color: payloadAnalysis.suspicious ? '#f87171' : '#4ade80',
                                            fontWeight: 600,
                                            border: payloadAnalysis.suspicious ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
                                        }}>
                                            {payloadAnalysis.suspicious && <AlertTriangle size={12} style={{ marginRight: '4px', display: 'inline' }} />}
                                            {payloadAnalysis.summary}
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
                                            {payloadAnalysis.formatted}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                <Shield size={14} /> Headers HTTP
                            </div>
                            
                            {/* Summary degli headers */}
                            {(() => {
                                const headersAnalysis = formatHeadersForHumans(log.headers);
                                return (
                                    <>
                                        <div style={{
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            marginBottom: '8px',
                                            fontSize: '0.8rem',
                                            color: '#60a5fa',
                                            fontWeight: 600,
                                            border: '1px solid rgba(59, 130, 246, 0.2)'
                                        }}>
                                            {headersAnalysis.summary}
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
                                            {headersAnalysis.formatted}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Query Params (if exist) */}
                    {Object.keys(log.query || {}).length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                <Globe size={14} /> Parametri Query
                            </div>
                            
                            {/* Summary dei query params */}
                            {(() => {
                                const queryParamsAnalysis = formatPayloadForHumans(log.query);
                                return (
                                    <>
                                        <div style={{
                                            background: queryParamsAnalysis.suspicious ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            marginBottom: '8px',
                                            fontSize: '0.8rem',
                                            color: queryParamsAnalysis.suspicious ? '#f59e0b' : '#22c55e',
                                            fontWeight: 600,
                                            border: queryParamsAnalysis.suspicious ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(34, 197, 94, 0.2)'
                                        }}>
                                            {queryParamsAnalysis.suspicious && <AlertTriangle size={12} style={{ marginRight: '4px', display: 'inline' }} />}
                                            {queryParamsAnalysis.summary}
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
                                                <div key={key} style={{ 
                                                    background: queryParamsAnalysis.keyFields.includes(key) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(30, 41, 59, 0.6)', 
                                                    padding: '6px 12px', 
                                                    borderRadius: '4px', 
                                                    border: queryParamsAnalysis.keyFields.includes(key) ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(148, 163, 184, 0.1)' 
                                                }}>
                                                    <span style={{ 
                                                        color: queryParamsAnalysis.keyFields.includes(key) ? '#f87171' : '#a855f7', 
                                                        fontWeight: 700, 
                                                        fontSize: '0.8rem' 
                                                    }}>
                                                        {key}:
                                                    </span>
                                                    <span style={{ 
                                                        color: queryParamsAnalysis.keyFields.includes(key) ? '#fca5a5' : '#e2e8f0', 
                                                        fontSize: '0.8rem', 
                                                        marginLeft: '6px',
                                                        wordBreak: 'break-all'
                                                    }}>
                                                        {String(val).length > 50 ? String(val).substring(0, 50) + '...' : String(val)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                );
                            })()}
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
