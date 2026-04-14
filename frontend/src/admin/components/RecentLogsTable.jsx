import React, { useState, useRef, useEffect, useMemo } from 'react';
import { sanitizeHTML } from '../../utils/sanitizer';

// Funzione helper per tradurre metodi HTTP in linguaggio comprensibile
const getMethodDescription = (method, path) => {
    if (method === 'SDK_REPORT' || path?.startsWith('sdk://')) {
        return { icon: '🛡️', text: 'SDK Defense', desc: 'Evento rilevato dallo scudo DIANA' };
    }

    const methods = {
        'GET': { icon: '🌐', text: 'Lettura', desc: 'Stava leggendo/informazioni' },
        'POST': { icon: '📩', text: 'Invio Dati', desc: 'Stava inviando dati/informazioni' },
        'PUT': { icon: '✏️', text: 'Aggiornamento', desc: 'Stava modificando qualcosa' },
        'DELETE': { icon: '🗑️', text: 'Eliminazione', desc: 'Stava cercando di eliminare' },
        'PATCH': { icon: '🛠️', text: 'Modifica', desc: 'Stava apportando modifiche' },
        'HEAD': { icon: '🔍', text: 'Controllo', desc: 'Stava controllando se esiste' },
        'OPTIONS': { icon: '⚙️', text: 'Opzioni', desc: 'Stava verificando opzioni' }
    };
    
    const methodInfo = methods[method] || { icon: '❓', text: method, desc: `Azione ${method}` };
    return methodInfo;
};

const RecentLogsTable = ({ logs, totalLogs, currentPage, onPageChange, onInvestigate, onFilterIP, onFilterFingerprint, limit = 50, order, onToggleOrder }) => {
    const totalPages = Math.ceil(totalLogs / limit);
    const containerRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);

    const ROW_HEIGHT = 48; // Standard row height in px
    const VISIBLE_COUNT = 15; // Number of rows to show
    const BUFFER = 5; // Rows to prepolulate above/below

    const { startIndex, endIndex, topSpacer, bottomSpacer } = useMemo(() => {
        const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
        const end = Math.min(logs.length, start + VISIBLE_COUNT + (BUFFER * 2));

        return {
            startIndex: start,
            endIndex: end,
            topSpacer: start * ROW_HEIGHT,
            bottomSpacer: (logs.length - end) * ROW_HEIGHT
        };
    }, [scrollTop, logs.length]);

    const handleScroll = (e) => {
        setScrollTop(e.target.scrollTop);
    };

    // Reset scroll when logs change (e.g. new page or refresh)
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = 0;
            // Defer setScrollTop to next frame to avoid synchronous setState warning
            requestAnimationFrame(() => {
                setScrollTop(0);
            });
        }
    }, [logs]);

    return (
        <section>
            <div className="flex justify-between items-center mb-1">
                <h3 style={{ color: 'white', margin: 0 }}>Log History ({totalLogs} events)</h3>

                {totalPages > 1 && (
                    <div className="flex gap-1 items-center">
                        <button
                            className="secondary"
                            disabled={currentPage === 1}
                            onClick={() => onPageChange(currentPage - 1)}
                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                        >
                            &larr; Prev
                        </button>
                        <span className="font-small font-bold" style={{ color: 'var(--accent)' }}>
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            className="secondary"
                            disabled={currentPage === totalPages}
                            onClick={() => onPageChange(currentPage + 1)}
                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                        >
                            Next &rarr;
                        </button>
                    </div>
                )}
            </div>

            <div
                className="table-container card terminal-card"
                ref={containerRef}
                onScroll={handleScroll}
                style={{
                    padding: 0,
                    height: '600px',
                    overflowY: 'auto',
                    position: 'relative'
                }}
            >
                <table>
                    <thead>
                        <tr>
                            <th
                                onClick={onToggleOrder}
                                style={{ cursor: 'pointer', userSelect: 'none', color: 'var(--researcher-green)' }}
                                title="Click to sort by time"
                            >
                                Timestamp {order === 'DESC' ? '▼' : '▲'}
                            </th>
                            <th>Project</th>
                            <th>Tipo Azione</th>
                            <th>Path</th>
                            <th>Attacker IP (VPN/Proxy)</th>
                            <th>Real IP (LEAKED)</th>
                            <th>Dispositivo</th>
                            <th>Risk</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {topSpacer > 0 && <tr><td colSpan="9" style={{ height: `${topSpacer}px` }}></td></tr>}
                        {logs.slice(startIndex, endIndex).map(log => {
                            const isLeaked = !!log.leakedIp;
                            const riskLevel = log.riskScore || 0;
                            
                            // Logica intelligente per i log dell'SDK
                            let displayMethod = log.method;
                            let displayPath = log.path;
                            let metadata = null;
                            
                            try {
                                metadata = typeof log.body === 'string' ? JSON.parse(log.body) : log.body;
                            } catch (e) { }

                            // Se è un log dell'SDK, estraiamo l'evento reale
                            if ((log.method === 'SDK_REPORT' || log.path?.startsWith('sdk://')) && log.path) {
                                const pathParts = log.path.split('/');
                                displayMethod = pathParts[pathParts.length - 1]; // L'evento (es. LOGIN_ATTEMPT)
                                
                                // Mostriamo il path originale se presente nei metadati
                                if (metadata && metadata.path) {
                                    displayPath = metadata.path;
                                }
                            }

                            const methodInfo = getMethodDescription(log.method, log.path);

                            return (
                                <tr key={log.id} style={{
                                    height: `${ROW_HEIGHT}px`,
                                    borderBottom: '1px solid var(--researcher-border)',
                                    backgroundColor: isLeaked ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                                }}>
                                    <td style={{ color: '#e2e8f0' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                    <td style={{ color: '#10b981', fontSize: '0.75rem' }}>
                                        {log.apiKey ? log.apiKey.name : <span className="text-muted">Internal</span>}
                                    </td>
                                    <td style={{ color: '#fbbf24', fontWeight: 'bold' }} title={methodInfo.desc}>
                                        <span style={{ marginRight: '4px' }}>{methodInfo.icon}</span>
                                        {displayMethod.replace(/_/g, ' ')}
                                    </td>
                                    <td className="monospace" title={displayPath} style={{ color: '#60a5fa' }}>
                                        {sanitizeHTML(displayPath?.substring(0, 25))}{displayPath?.length > 25 ? '...' : ''}
                                    </td>
                                    <td>
                                        <span
                                            className="monospace text-researcher"
                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                            onClick={() => onFilterIP && onFilterIP(log.ipAddress || log.ip)}
                                        >
                                            {sanitizeHTML(log.ipAddress || log.ip || '0.0.0.0')}
                                        </span>
                                    </td>
                                    <td>
                                        {isLeaked ? (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span className="monospace" style={{ color: '#ef4444', fontWeight: 'bold' }}>
                                                    ⚠️ {sanitizeHTML(log.leakedIp)}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>Not leaked</span>
                                        )}
                                    </td>
                                    <td>
                                        {log.fingerprint ? (
                                            <span
                                                className="monospace"
                                                style={{ cursor: 'pointer', color: '#a78bfa', fontSize: '0.7rem' }}
                                                onClick={() => onFilterFingerprint && onFilterFingerprint(log.fingerprint)}
                                            >
                                                {sanitizeHTML(log.fingerprint.substring(0, 8))}
                                            </span>
                                        ) : <span className="text-muted">N/A</span>}
                                    </td>
                                    <td>
                                        <span className={`tag ${riskLevel >= 50 ? 'tag-danger' : riskLevel >= 20 ? 'tag-warning' : ''}`}>
                                            {riskLevel}
                                        </span>
                                    </td>
                                    <td>
                                        <button onClick={() => onInvestigate(log)} className="primary">Investigate</button>
                                    </td>
                                </tr>
                            );
                        })}
                        {bottomSpacer > 0 && <tr><td colSpan="9" style={{ height: `${bottomSpacer}px` }}></td></tr>}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    No logs matching the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="flex-center mt-2 gap-1">
                    <button
                        className="secondary"
                        disabled={currentPage === 1}
                        onClick={() => onPageChange(currentPage - 1)}
                    >
                        Previous
                    </button>
                    <div className="flex gap-0-5">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                            // Semplice logica per mostrare 5 pagine intorno alla corrente
                            let pageNum = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                            if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                            if (pageNum <= 0) return null;
                            if (pageNum > totalPages) return null;

                            return (
                                <button
                                    key={pageNum}
                                    className={currentPage === pageNum ? 'btn-primary' : 'secondary'}
                                    style={{ minWidth: '35px', padding: '4px' }}
                                    onClick={() => onPageChange(pageNum)}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        className="secondary"
                        disabled={currentPage === totalPages}
                        onClick={() => onPageChange(currentPage + 1)}
                    >
                        Next
                    </button>
                </div>
            )}
        </section>
    );
};

export default RecentLogsTable;