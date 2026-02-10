import React from 'react';

const RecentLogsTable = ({ logs, riskFilter, onInvestigate, onFilterIP, onFilterFingerprint, limit }) => {
    return (
        <section>
            <h3 className="mb-1" style={{ color: 'white' }}>Live Feed (Filtered)</h3>
            <div className="table-container card terminal-card" style={{ padding: 0 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Method</th>
                            <th>Path</th>
                            <th>Attacker IP (VPN/Proxy)</th>
                            <th>Real IP (LEAKED)</th>
                            <th>Browser ID</th>
                            <th>Risk</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.slice(0, limit || logs.length).map(log => {
                            const isLeaked = !!log.leakedIp;
                            return (
                                <tr key={log.id} style={{
                                    borderBottom: '1px solid var(--researcher-border)',
                                    backgroundColor: isLeaked ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                                }}>
                                    <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                                    <td style={{ color: '#fbbf24', fontWeight: 'bold' }}>{log.method}</td>
                                    <td className="monospace" title={log.path}>
                                        {log.path?.substring(0, 20)}{log.path?.length > 20 ? '...' : ''}
                                    </td>
                                    <td>
                                        <span
                                            className="monospace text-researcher"
                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                            onClick={() => onFilterIP && onFilterIP(log.ipAddress || log.ip)}
                                            title="Click to filter by this IP"
                                        >
                                            {log.ipAddress || log.ip || '0.0.0.0'}
                                        </span>
                                    </td>
                                    <td>
                                        {isLeaked ? (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span
                                                    className="monospace"
                                                    style={{ color: '#ef4444', fontWeight: 'bold' }}
                                                    title="REAL IP DETECTED VIA WEBRTC"
                                                >
                                                    ⚠️ {log.leakedIp}
                                                </span>
                                                {log.localIp && (
                                                    <small className="text-muted monospace" style={{ fontSize: '0.6rem' }}>
                                                        LAN: {log.localIp}
                                                    </small>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>Not leaked</span>
                                        )}
                                    </td>
                                    <td>
                                        {log.fingerprint ? (
                                            <span
                                                className="monospace"
                                                style={{
                                                    cursor: 'pointer',
                                                    color: '#a78bfa',
                                                    fontSize: '0.7rem',
                                                    border: '1px solid rgba(167, 139, 250, 0.3)',
                                                    padding: '2px 4px',
                                                    borderRadius: '3px'
                                                }}
                                                onClick={() => onFilterFingerprint && onFilterFingerprint(log.fingerprint)}
                                                title={`Fingerprint: ${log.fingerprint}\nClick to track this device`}
                                            >
                                                {log.fingerprint.substring(0, 8)}
                                            </span>
                                        ) : (
                                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>N/A</span>
                                        )}
                                    </td>
                                    <td>
                                        <span
                                            className={`tag ${log.riskScore >= 50 ? 'tag-danger' : log.riskScore >= 20 ? 'tag-warning' : ''}`}
                                            style={{
                                                fontWeight: 'bold',
                                                backgroundColor: log.riskScore >= 50 ? '#dc2626' :
                                                    log.riskScore >= 20 ? '#f59e0b' :
                                                        'rgba(255,255,255,0.1)'
                                            }}
                                        >
                                            {log.riskScore || 0}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => onInvestigate(log)}
                                            className="primary"
                                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                        >
                                            Investigate
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    No logs matching the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default RecentLogsTable;