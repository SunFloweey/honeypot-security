import React from 'react';

const RecentLogsTable = ({ logs, riskFilter, onInvestigate, limit }) => {
    return (
        <section>
            <h3 className="mb-1" style={{ color: 'white' }}>Live Feed (Filtered: Risk &gt; {riskFilter})</h3>
            <div className="table-container card terminal-card" style={{ padding: 0 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Method</th>
                            <th>Path</th>
                            <th>IP</th>
                            <th>Risk Score</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.slice(0, limit || logs.length).map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid var(--researcher-border)' }}>
                                <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                                <td style={{ color: '#fbbf24' }}>{log.method}</td>
                                <td className="monospace">{log.path.substring(0, 30)}{log.path.length > 30 ? '...' : ''}</td>
                                <td>{log.ipAddress}</td>
                                <td>
                                    {log.Classifications?.map(c => (
                                        <span key={c.id} className="tag tag-danger" style={{ marginRight: '5px' }}>
                                            {c.category} ({c.riskScore})
                                        </span>
                                    ))}
                                </td>
                                <td>
                                    <button onClick={() => onInvestigate(log)} className="primary" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>Investigate</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default RecentLogsTable;
