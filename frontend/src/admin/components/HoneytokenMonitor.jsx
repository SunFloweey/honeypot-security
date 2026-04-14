import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Key, Database, Cloud, Lock, AlertTriangle, RefreshCw, Eye, EyeOff, Activity } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

/**
 * HoneytokenMonitor - Displays active honeytokens and usage alerts
 * 
 * Shows:
 * 1. Summary of all active honeytokens by type
 * 2. Real-time usage events (when someone uses a fake credential)
 * 3. Visual indicators for token categories
 */
const HoneytokenMonitor = () => {
    const { getToken } = useAdminAuth();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [showCredential, setShowCredential] = useState({});

    const TOKEN_TYPE_CONFIG = {
        aws_access_key: { icon: Cloud, label: 'AWS Access Keys', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        mongo_connection: { icon: Database, label: 'MongoDB Connections', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        stripe_secret: { icon: Key, label: 'Stripe API Keys', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
        jwt_secret: { icon: Lock, label: 'JWT Secrets', color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
        postgres_password: { icon: Database, label: 'PostgreSQL Passwords', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
        github_token: { icon: Shield, label: 'GitHub Tokens', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
    };

    const fetchSummary = useCallback(async () => {
        try {
            setLoading(true);
            const token = getToken();
            const headers = localStorage.getItem('saasToken')
                ? { 'Authorization': `Bearer ${token}` }
                : { 'x-admin-token': token };

            const response = await fetch('/api/ai/honeytokens/summary', {
                headers
            });

            if (!response.ok) throw new Error('Failed to fetch honeytoken summary');

            const data = await response.json();
            setSummary(data);
            setLastRefresh(new Date().toLocaleTimeString());
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSummary();
        const interval = setInterval(fetchSummary, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [fetchSummary]);

    const toggleCredentialVisibility = (idx) => {
        setShowCredential(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    return (
        <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '24px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Key size={24} color="#fff" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#e2e8f0' }}>
                            Honeytoken Monitor
                        </h2>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                            Track fake credentials embedded in honeypot responses
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {lastRefresh && (
                        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Last refresh: {lastRefresh}
                        </span>
                    )}
                    <button
                        onClick={fetchSummary}
                        disabled={loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: 'rgba(148,163,184,0.1)',
                            border: '1px solid rgba(148,163,184,0.15)',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            transition: 'all 0.2s',
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                </div>
            </div>

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

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
            }}>
                {/* Total Active */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.05))',
                    border: '1px solid rgba(245,158,11,0.15)',
                    borderRadius: '12px',
                    padding: '20px',
                }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                        Active Honeytokens
                    </div>
                    <div style={{ color: '#f59e0b', fontSize: '2rem', fontWeight: 800 }}>
                        {summary?.totalActive || 0}
                    </div>
                </div>

                {/* Usage Events */}
                <div style={{
                    background: summary?.recentUsage?.length > 0
                        ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))'
                        : 'rgba(15,23,42,0.4)',
                    border: summary?.recentUsage?.length > 0
                        ? '1px solid rgba(239,68,68,0.3)'
                        : '1px solid rgba(148,163,184,0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    animation: summary?.recentUsage?.length > 0 ? 'pulse 2s infinite' : 'none',
                }}>
                    <div style={{
                        color: summary?.recentUsage?.length > 0 ? '#f87171' : '#94a3b8',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        marginBottom: '4px',
                    }}>
                        {summary?.recentUsage?.length > 0 ? '🚨 USAGE DETECTED' : 'Usage Events'}
                    </div>
                    <div style={{
                        color: summary?.recentUsage?.length > 0 ? '#ef4444' : '#64748b',
                        fontSize: '2rem',
                        fontWeight: 800,
                    }}>
                        {summary?.recentUsage?.length || 0}
                    </div>
                </div>

                {/* Token Types */}
                <div style={{
                    background: 'rgba(15,23,42,0.4)',
                    border: '1px solid rgba(148,163,184,0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                        Token Types
                    </div>
                    <div style={{ color: '#e2e8f0', fontSize: '2rem', fontWeight: 800 }}>
                        {summary?.byType ? Object.keys(summary.byType).length : 0}
                    </div>
                </div>
            </div>

            {/* Active Tokens by Type */}
            {summary?.byType && Object.keys(summary.byType).length > 0 && (
                <div style={{
                    background: 'rgba(15,23,42,0.4)',
                    border: '1px solid rgba(148,163,184,0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '24px',
                }}>
                    <h3 style={{
                        color: '#e2e8f0',
                        fontSize: '1rem',
                        fontWeight: 700,
                        marginTop: 0,
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}>
                        <Activity size={18} /> Active Tokens by Type
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {Object.entries(summary.byType).map(([type, count]) => {
                            const config = TOKEN_TYPE_CONFIG[type] || {
                                icon: Key,
                                label: type.replace(/_/g, ' '),
                                color: '#94a3b8',
                                bg: 'rgba(148,163,184,0.1)',
                            };
                            const Icon = config.icon;

                            return (
                                <div key={type} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 18px',
                                    borderRadius: '10px',
                                    background: config.bg,
                                    border: `1px solid ${config.color}30`,
                                }}>
                                    <Icon size={18} style={{ color: config.color }} />
                                    <div>
                                        <div style={{ color: config.color, fontSize: '0.8rem', fontWeight: 700 }}>
                                            {config.label}
                                        </div>
                                        <div style={{ color: '#e2e8f0', fontSize: '1.2rem', fontWeight: 800 }}>
                                            {count}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Usage Events Log */}
            {summary?.recentUsage?.length > 0 && (
                <div style={{
                    background: 'rgba(239,68,68,0.05)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '12px',
                    padding: '20px',
                }}>
                    <h3 style={{
                        color: '#f87171',
                        fontSize: '1rem',
                        fontWeight: 700,
                        marginTop: 0,
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}>
                        <AlertTriangle size={18} /> 🚨 Honeytoken Usage Alerts
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {summary.recentUsage.map((event, idx) => (
                            <div key={idx} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                background: 'rgba(239,68,68,0.08)',
                                borderRadius: '8px',
                                border: '1px solid rgba(239,68,68,0.15)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{
                                        background: 'rgba(239,68,68,0.2)',
                                        color: '#fca5a5',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                    }}>
                                        {event.type?.replace(/_/g, ' ') || 'unknown'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button
                                            onClick={() => toggleCredentialVisibility(idx)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#94a3b8',
                                                padding: '2px',
                                            }}
                                        >
                                            {showCredential[idx] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                        <span style={{
                                            color: '#e2e8f0',
                                            fontFamily: 'monospace',
                                            fontSize: '0.8rem',
                                        }}>
                                            {showCredential[idx] ? event.credential : '••••••••••••••••'}
                                        </span>
                                    </div>
                                </div>
                                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                    {event.detectedAt ? new Date(event.detectedAt).toLocaleString() : 'N/A'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {summary?.totalActive === 0 && !loading && (
                <div style={{
                    textAlign: 'center',
                    padding: '48px',
                    color: '#64748b',
                }}>
                    <Key size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>No active honeytokens yet</p>
                    <p style={{ fontSize: '0.85rem' }}>
                        Honeytokens are generated automatically when attackers access
                        trap files like /.env, /config.json, or /docker-compose.yml
                    </p>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.85; }
                }
            `}</style>
        </div>
    );
};

export default HoneytokenMonitor;
