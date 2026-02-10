import React from 'react';

const LogDetailModal = ({ log, onClose }) => {
    if (!log) return null;

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div className="card terminal-card" style={{ width: '90%', maxWidth: '1000px', maxHeight: '85vh', overflowY: 'auto' }}>
                <div className="flex justify-between items-center mb-2">
                    <h2 style={{ color: 'white' }}>Detail: {log.method} {log.path}</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
                </div>
                <div className="grid-2-col">
                    <div>
                        <h4 className="mb-1">Request Payload</h4>
                        <div className="terminal-view" style={{ height: 'auto', minHeight: '200px' }}>
                            {typeof log.body === 'string' ? log.body : JSON.stringify(log.body, null, 2)}
                        </div>
                    </div>
                    <div>
                        <h4 className="mb-1">Audit Headers</h4>
                        <div className="terminal-view" style={{ height: 'auto', minHeight: '200px', color: 'var(--text-muted)' }}>
                            {JSON.stringify(log.headers, null, 2)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogDetailModal;
