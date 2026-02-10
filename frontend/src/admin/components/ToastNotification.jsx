import React, { useEffect } from 'react';

const ToastNotification = ({ notification, onClose, onInvestigate }) => {
    useEffect(() => {
        // Auto hide after 10s
        const timer = setTimeout(() => {
            onClose();
        }, 10000);
        return () => clearTimeout(timer);
    }, [notification, onClose]);

    if (!notification) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: 'var(--danger)',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 3000,
            animation: 'slideIn 0.3s ease-out',
            maxWidth: '350px'
        }}>
            <div className="flex justify-between items-start mb-2">
                <strong style={{ fontSize: '1.1rem' }}>⚠️ THREAT DETECTED</strong>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
            </div>
            <p className="mb-1">{notification.message}</p>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                <div>Session Risk: {notification.riskScore}/100</div>
                {notification.ipTotalRisk && (
                    <div style={{ color: '#fef08a', fontWeight: 'bold' }}>
                        IP Total Risk: {notification.ipTotalRisk}
                    </div>
                )}
                <div className="monospace mt-1">{notification.ipAddress}</div>
            </div>
            <button
                onClick={() => { onInvestigate(notification.sessionKey); onClose(); }}
                style={{
                    marginTop: '10px',
                    backgroundColor: 'white',
                    color: 'var(--danger)',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    width: '100%'
                }}
            >
                INVESTIGATE NOW
            </button>
        </div>
    );
};

export default ToastNotification;
