import React from 'react';

const SessionDetail = ({ viewData, onBack, onSelectLog }) => {
    if (!viewData) return null;

    return (
        <>
            <header className="mb-2">
                <button className="secondary mb-1" onClick={onBack}>← Back to Overview</button>
                <h1>Forensic Timeline</h1>
                <p className="text-muted mb-1">Session: {viewData.sessionKey} | IP: {viewData.ipAddress}</p>
                <div className="flex gap-1 flex-wrap">
                    <div className="card terminal-card" style={{ padding: '8px 15px', marginBottom: 0 }}>
                        <small className="text-muted block font-tiny">RESOLUTION</small>
                        <div className="font-small font-bold">{viewData.screenResolution || 'n/a'}</div>
                    </div>
                    <div className="card terminal-card" style={{ padding: '8px 15px', marginBottom: 0 }}>
                        <small className="text-muted block font-tiny">LANGUAGE</small>
                        <div className="font-small font-bold">{viewData.browserLanguage || 'n/a'}</div>
                    </div>
                    <div className="card terminal-card" style={{ padding: '8px 15px', marginBottom: 0 }}>
                        <small className="text-muted block font-tiny">TIMEZONE</small>
                        <div className="font-small font-bold">{viewData.timezone || 'n/a'}</div>
                    </div>
                    <div className="card terminal-card" style={{ padding: '8px 15px', marginBottom: 0 }}>
                        <small className="text-muted block font-tiny">PLATFORM</small>
                        <div className="font-small font-bold">{viewData.platform || 'n/a'}</div>
                    </div>
                </div>
            </header>

            <div style={{ position: 'relative', paddingLeft: '40px', marginTop: '2rem' }}>
                <div style={{ position: 'absolute', left: '19px', top: 0, bottom: 0, width: '2px', backgroundColor: 'var(--researcher-border)' }}></div>
                {viewData.Logs?.map((log) => (
                    <div key={log.id} style={{ position: 'relative', marginBottom: '2rem' }}>
                        <div style={{
                            position: 'absolute',
                            left: '-26px',
                            top: '15px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: log.Classifications?.length > 0 ? 'var(--danger)' : 'var(--researcher-green)',
                        }}></div>
                        <div className="card terminal-card" style={{ padding: '1rem', cursor: 'pointer', border: log.Classifications?.length > 0 ? '1px solid var(--danger)' : '1px solid var(--researcher-border)' }} onClick={() => onSelectLog(log)}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold">{log.method} {log.path}</span>
                                <span className="font-tiny text-muted">{new Date(log.timestamp).toLocaleTimeString()} ({log.responseTimeMs}ms)</span>
                            </div>
                            <div className="flex gap-1">
                                {log.Classifications?.map(c => (
                                    <span key={c.id} className="tag tag-danger">
                                        {c.category} (+{c.riskScore})
                                    </span>
                                ))}
                                <span className="tag" style={{ backgroundColor: 'var(--researcher-sidebar)', color: 'var(--text-muted)' }}>Status: {log.statusCode}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export default SessionDetail;
