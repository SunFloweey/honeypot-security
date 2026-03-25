import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

/**
 * Gestione Chiavi di Accesso DIANA
 * Interfaccia sicura per creare e gestire le credenziali di accesso alla piattaforma
 * Permette di controllare chiavi attive e revocare accessi non autorizzati
 */
const ApiKeyManager = () => {
    const { getToken, getUser } = useAdminAuth();
    const user = getUser();
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newKeyName, setNewKeyName] = useState('');
    const [error, setError] = useState('');

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const token = getToken();
            const headers = localStorage.getItem('saasToken')
                ? { 'Authorization': `Bearer ${token}` }
                : { 'x-admin-token': token };

            const res = await fetch('/api/v1/saas/keys', { headers });
            const data = await res.json();
            if (data.success) {
                setKeys(data.keys);
            }
        } catch (err) {
            setError('Impossibile caricare le chiavi API.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleCreateKey = async (e) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        try {
            const token = getToken();
            const headers = localStorage.getItem('saasToken')
                ? {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
                : {
                    'x-admin-token': token,
                    'Content-Type': 'application/json'
                };

            const res = await fetch('/api/v1/saas/keys', {
                method: 'POST',
                headers,
                body: JSON.stringify({ name: newKeyName })
            });
            const data = await res.json();
            if (data.success) {
                setNewKeyName('');
                fetchKeys();
            } else {
                setError(data.error || 'Errore nella creazione della chiave.');
            }
        } catch (err) {
            setError('Errore di connessione.');
        }
    };

    const handleDeleteKey = async (id) => {
        if (!window.confirm('Sei sicuro di voler revocare questa chiave API?')) return;

        try {
            const token = getToken();
            const headers = localStorage.getItem('saasToken')
                ? { 'Authorization': `Bearer ${token}` }
                : { 'x-admin-token': token };

            const res = await fetch(`/api/v1/saas/keys/${id}`, {
                method: 'DELETE',
                headers
            });
            const data = await res.json();
            if (data.success) {
                fetchKeys();
            }
        } catch (err) {
            setError('Errore nella revoca.');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Chiave API copiata negli appunti!');
    };

    const downloadSDK = async () => {
        try {
            const token = getToken();
            const headers = localStorage.getItem('saasToken')
                ? {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
                : {
                    'x-admin-token': token,
                    'Content-Type': 'application/json'
                };

            const activeKey = keys.find(k => k.isActive);
            if (!activeKey) {
                alert('Devi avere almeno una chiave API attiva per scaricare l\'SDK.');
                return;
            }

            const res = await fetch('/api/v1/saas/sdk-download', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    projectName: activeKey.name,
                    useAutoProtect: true,
                    securityLevel: 'medium'
                })
            });

            if (!res.ok) throw new Error('Download fallito');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diana-sdk-${activeKey.name}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (err) {
            alert('Errore durante il download dell\'SDK: ' + err.message);
        }
    };

    return (
        <div className="api-key-manager">
            <header className="mb-2">
                <h1>Gestione Chiavi API</h1>
                <p className="text-muted">Utilizza queste chiavi per proteggere le tue applicazioni con il sistema DIANA.</p>
            </header>

            {error && <div className="tag tag-danger mb-2" style={{ padding: '0.5rem 1rem' }}>{error}</div>}

            <div className="card terminal-card mb-2" style={{ padding: '1.5rem' }}>
                <h3 style={{ color: 'white', marginBottom: '1rem' }}>Nuova Chiave</h3>
                {user?.isGlobal ? (
                    <div className="tag tag-info w-full" style={{ padding: '10px', fontSize: '0.85rem' }}>
                        ℹ️ Come Super-Admin globale, non puoi generare chiavi personali. Gestisci le chiavi dei tuoi clienti nella sezione <strong>'Gestione Clienti'</strong>.
                    </div>
                ) : (
                    <form onSubmit={handleCreateKey} style={{ display: 'flex', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="Nome Progetto (es. Negozio Online)"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            className="monospace"
                            style={{
                                flex: 1,
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid var(--researcher-border)',
                                color: 'white',
                                padding: '8px'
                            }}
                        />
                        <button type="submit" className="btn-primary">Genera Chiave</button>
                    </form>
                )}
            </div>

            <div className="table-container card terminal-card" style={{ padding: 0 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Progetto</th>
                            <th>Chiave API</th>
                            <th>Stato</th>
                            <th>Ultimo Uso</th>
                            <th>Data Creazione</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {keys.map(k => (
                            <tr key={k.id}>
                                <td style={{ color: 'var(--researcher-green)', fontWeight: 'bold' }}>{k.name}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <code className="monospace" style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                            {k.key.substring(0, 10)}...{k.key.substring(k.key.length - 4)}
                                        </code>
                                        <button
                                            onClick={() => copyToClipboard(k.key)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                                            title="Copia chiave intera"
                                        >
                                            📋
                                        </button>
                                    </div>
                                </td>
                                <td>
                                    <span className={`tag ${k.isActive ? 'tag-success' : 'tag-muted'}`}>
                                        {k.isActive ? 'Attiva' : 'Revocata'}
                                    </span>
                                </td>
                                <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Mai usata'}
                                </td>
                                <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                                    {new Date(k.createdAt).toLocaleDateString()}
                                </td>
                                <td>
                                    <button
                                        onClick={() => handleDeleteKey(k.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >
                                        Revoca
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {keys.length === 0 && !loading && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    Non hai ancora generato chiavi API.
                                </td>
                            </tr>
                        )}
                        {loading && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Caricamento...</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* QUICK SETUP GUIDE FOR CLIENTS LIKE CIRO - ONLY FOR CLIENT ROLE */}
            {user?.role === 'user' && (
                <div className="card terminal-card mt-2" style={{ padding: '1.5rem', border: '1px solid var(--researcher-green)' }}>
                    <h3 style={{ color: 'var(--researcher-green)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        🚀 Integrazione Rapida (SDK)
                    </h3>
                    <p className="text-muted mb-2">Copia e incolla questo snippet nel tuo progetto Node.js per iniziare a catturare attacchi in tempo reale.</p>

                    <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <small style={{ color: '#64748b', fontWeight: 'bold' }}>EXPRESS / NODE.JS</small>
                            <button
                                className="btn-primary"
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                                onClick={() => copyToClipboard(`const Honeypot = require('@hp/sdk');\n\nconst client = new Honeypot({\n  apiKey: '${keys[0]?.key || 'INSERISCI_TUA_CHIAVE'}'\n});`)}
                            >
                                Copia Codice
                            </button>
                        </div>
                        <pre className="monospace" style={{ margin: 0, fontSize: '0.85rem', color: '#38bdf8', overflowX: 'auto' }}>
                            {`const Honeypot = require('@hp/sdk');

const client = new Honeypot({
  apiKey: '${keys[0]?.key || 'INSERISCI_TUA_CHIAVE'}'
});

// Middleware per monitorare tutto il traffico sospetto
app.use(client.monitor());`}
                        </pre>
                    </div>

                    <div className="mt-2" style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <h4 style={{ color: 'white', fontSize: '0.9rem', marginBottom: '5px' }}>📦 Pacchetto Completo</h4>
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Scarica l'SDK pre-configurato con la tua chiave e pronto per l'installazione immediata.</p>
                            <button 
                                className="btn-primary mt-1" 
                                onClick={downloadSDK}
                                style={{ background: 'var(--researcher-green)', color: 'black' }}
                            >
                                ⬇️ Scarica Bundle SDK (ZIP)
                            </button>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <h4 style={{ color: 'white', fontSize: '0.9rem', marginBottom: '5px' }}>🛡️ Protezione Attiva</h4>
                            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Include esche interattive (webshell finti) per intrappolare gli attaccanti.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiKeyManager;
