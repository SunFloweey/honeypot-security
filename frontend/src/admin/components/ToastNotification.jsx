import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const ToastNotification = ({ notification, onClose, onInvestigate }) => {
    const { getToken } = useAdminAuth();
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => onClose(), 15000);
        return () => clearTimeout(timer);
    }, [notification, onClose]);

    if (!notification) return null;

    const heuristic = notification.heuristic || {};
    const brain = notification.the_brain || {};
    const response = notification.response || {};
    const severity = response.severity || (notification.level === 'Critical' ? 'Critical' : 'Medium');
    const severityColor = severity === 'Critical' || severity === 'High' ? '#ef4444' : '#f59e0b';

    const handleAction = async (action, body) => {
        setActionLoading(true);
        try {
            const res = await fetch(`/api/${action}`, {
                // In un ambiente reale qui useremmo l'host corretto
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': getToken()
                },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                console.log(`Action ${action} successful`);
                onClose();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '25px',
            backgroundColor: '#0f172a',
            border: `1px solid ${severityColor}44`,
            borderLeft: `5px solid ${severityColor}`,
            color: '#f1f5f9',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            animation: 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            width: '420px',
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif"
        }}>
            {/* Header / Meta */}
            <div style={{
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.02)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        backgroundColor: `${severityColor}22`,
                        color: severityColor,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.65rem',
                        fontWeight: '800',
                        textTransform: 'uppercase'
                    }}>
                        {severity} ALERT
                    </span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.5 }} className="monospace">
                        ID: {notification.sessionKey?.substring(0, 8) || 'Unknown'}
                    </span>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ padding: '20px' }}>
                {/* A. Analisi Euristica (Dati Raw) */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>📡</span>
                        <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                            A. Analisi Euristica (Dati Raw)
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '2px' }}>Origin & Intel</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f8fafc' }} className="monospace">
                                {heuristic.primaryIp || notification.ipAddress}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '4px' }}>
                                📍 {heuristic.geo || 'Global Node'}
                            </div>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, marginBottom: '2px' }}>Risk Score</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: '900', color: severityColor }}>
                                {heuristic.riskScore || notification.riskScore}
                                <span style={{ fontSize: '0.7rem', fontWeight: 'normal', opacity: 0.5 }}>/100</span>
                            </div>
                        </div>
                    </div>
                    {heuristic.payload && (
                        <div style={{
                            marginTop: '10px',
                            fontSize: '0.7rem',
                            background: '#020617',
                            padding: '10px',
                            borderRadius: '6px',
                            color: '#4ade80',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            maxHeight: '45px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }} className="monospace">
                            <b>Payload:</b> {heuristic.payload}
                        </div>
                    )}
                </div>

                {/* B. Strato IA (Il Brain) */}
                <div style={{
                    marginBottom: '20px',
                    padding: '16px',
                    backgroundColor: 'rgba(16, 185, 129, 0.03)',
                    borderRadius: '10px',
                    border: '1px solid rgba(16, 185, 129, 0.1)',
                    position: 'relative'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '1.1rem' }}>🤖</span>
                        <label style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            B. Strato IA (Il Brain)
                        </label>
                    </div>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: 0, color: '#cbd5e1', fontWeight: '400' }}>
                        {brain.analysis || notification.intent || notification.message}
                    </p>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '12px', fontSize: '0.7rem', borderTop: '1px solid rgba(16, 185, 129, 0.1)', paddingTop: '8px' }}>
                        <span style={{ color: '#94a3b8' }}>Actor: <b style={{ color: '#10b981' }}>{brain.actorType || (notification.isBot ? 'Bot' : 'Human')}</b></span>
                        <span style={{ color: '#94a3b8' }}>Intent: <b style={{ color: '#10b981' }}>{brain.intent || 'Probing'}</b></span>
                    </div>
                </div>

                {/* C. Azioni Immediate (Response) */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>⚡</span>
                        <label style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            C. Azioni Immediate (Response)
                        </label>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            disabled={actionLoading}
                            onClick={() => handleAction('ip/ban', { ipAddress: heuristic.primaryIp || notification.ipAddress })}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            BAN IP
                        </button>
                        <button
                            disabled={actionLoading}
                            onClick={() => handleAction('session/isolate', { sessionKey: notification.sessionKey })}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: 'transparent',
                                color: '#3b82f6',
                                border: '1px solid #3b82f6',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            ISOLATE
                        </button>
                        <button
                            disabled={actionLoading}
                            onClick={() => { onInvestigate(notification.sessionKey); onClose(); }}
                            style={{
                                flex: 1.2,
                                padding: '8px',
                                background: '#f1f5f9',
                                color: '#0f172a',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            DETAILS
                        </button>
                    </div>
                    <button
                        disabled={actionLoading}
                        onClick={() => handleAction('notify/ignore', { sessionKey: notification.sessionKey, ipAddress: heuristic.primaryIp || notification.ipAddress })}
                        style={{
                            marginTop: '15px',
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            fontSize: '0.65rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            opacity: 0.7
                        }}
                    >
                        Ignora (Falso Positivo)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ToastNotification;
