import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const TenantManager = () => {
    const { getToken } = useAdminAuth();
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        phoneNumber: ''
    });

    const fetchTenants = async () => {
        setLoading(true);
        try {
            const token = getToken();
            const res = await fetch('/api/v1/saas/tenants', {
                headers: { 'x-admin-token': token }
            });
            const data = await res.json();
            if (data.success) {
                setTenants(data.tenants);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Impossibile caricare la lista clienti.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTenants();
    }, []);

    const [lastProvisioned, setLastProvisioned] = useState(null);

    const handleProvision = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLastProvisioned(null);

        try {
            const token = getToken();
            const res = await fetch('/api/v1/saas/provision', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': token
                },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                setSuccess(`✅ Cliente ${formData.name} attivato!`);
                setLastProvisioned({
                    email: formData.email,
                    password: data.temporaryPassword
                });
                setFormData({ email: '', name: '', phoneNumber: '' });
                fetchTenants();
            } else {
                setError(data.error || 'Errore durante l\'attivazione.');
            }
        } catch (err) {
            setError('Errore di connessione al server.');
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        try {
            const token = getToken();
            await fetch(`/api/v1/saas/tenants/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-token': token
                },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            fetchTenants();
        } catch (err) {
            setError('Errore durante l\'aggiornamento dello stato.');
        }
    };

    const handleDeleteTenant = async (id, name) => {
        if (!window.confirm(`ATTENZIONE: Stai per eliminare DEFINITIVAMENTE "${name}". Continuare?`)) return;
        try {
            const token = getToken();
            const res = await fetch(`/api/v1/saas/tenants/${id}`, {
                method: 'DELETE',
                headers: { 'x-admin-token': token }
            });
            if (res.ok) fetchTenants();
        } catch (err) {
            setError('Errore durante l\'eliminazione.');
        }
    };

    return (
        <div className="tenant-manager">
            <header className="mb-2">
                <h1 style={{ color: 'var(--researcher-green)' }}>Gestione Clienti (Admin Console)</h1>
                <p className="text-muted">Pannello di controllo per il provisioning dei nuovi tenant SaaS.</p>
            </header>

            <div className="grid-2-col">
                {/* Form di Attivazione */}
                <div className="card terminal-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ color: 'white', marginBottom: '1.5rem' }}>Attiva Nuovo Cliente</h3>

                    {error && <div className="tag tag-danger mb-2 w-full">{error}</div>}
                    {success && (
                        <div className="mb-2">
                            <div className="tag tag-success w-full mb-1">{success}</div>
                            {lastProvisioned && (
                                <div style={{
                                    background: '#1e293b',
                                    border: '1px solid var(--researcher-green)',
                                    padding: '1rem',
                                    borderRadius: '4px',
                                    marginTop: '0.5rem'
                                }}>
                                    <h4 style={{ color: 'var(--researcher-green)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>🔐 CREDENZIALI GENERATE</h4>
                                    <div className="monospace" style={{ fontSize: '0.85rem' }}>
                                        <div style={{ marginBottom: '4px' }}><strong>Username:</strong> {lastProvisioned.email}</div>
                                        <div><strong>Password:</strong> <span style={{ color: '#fbbf24' }}>{lastProvisioned.password}</span></div>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem', fontStyle: 'italic' }}>
                                        Copia queste credenziali ora. Per sicurezza, non verranno mostrate di nuovo.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleProvision}>
                        <div className="mb-1">
                            <label className="text-muted block mb-1">Nome Cliente / Azienda</label>
                            <input
                                type="text"
                                placeholder="es. Ciro - Biscotti S.p.A."
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full monospace"
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--researcher-border)', color: 'white', padding: '10px' }}
                                required
                            />
                        </div>
                        <div className="mb-1">
                            <label className="text-muted block mb-1">Email (Username)</label>
                            <input
                                type="email"
                                placeholder="ciro@biscotti.it"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full monospace"
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--researcher-border)', color: 'white', padding: '10px' }}
                                required
                            />
                        </div>
                        <div className="mb-2">
                            <label className="text-muted block mb-1">Cellulare (per Password SMS)</label>
                            <input
                                type="text"
                                placeholder="+39 333 1234567"
                                value={formData.phoneNumber}
                                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                className="w-full monospace"
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--researcher-border)', color: 'white', padding: '10px' }}
                                required
                            />
                        </div>
                        <button type="submit" className="btn-primary w-full" style={{ padding: '12px' }}>
                            🚀 ATTIVA E INVIA CREDENZIALI
                        </button>
                    </form>
                </div>

                {/* Statistiche Rapide */}
                <div className="card terminal-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ color: 'white', marginBottom: '1rem' }}>Sintesi Business</h3>
                    <div className="grid-2-col" style={{ gap: '1rem' }}>
                        <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--researcher-green)' }}>{tenants.length}</div>
                            <div className="text-muted">Clienti Totali</div>
                        </div>
                        <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--researcher-green)' }}>
                                {tenants.reduce((acc, t) => acc + (t.apiKeys?.length || 0), 0)}
                            </div>
                            <div className="text-muted">Progetti Attivi</div>
                        </div>
                    </div>
                    <div className="mt-2" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        <p>ℹ️ Le credenziali vengono inviate tramite canali Out-of-Band separati per garantire la massima sicurezza al cliente.</p>
                    </div>
                </div>
            </div>

            <div className="table-container card terminal-card mt-2" style={{ padding: 0 }}>
                <header style={{ padding: '1rem', borderBottom: '1px solid var(--researcher-border)' }}>
                    <h3 style={{ color: 'white', margin: 0 }}>Elenco Clienti Attivi</h3>
                </header>
                <table>
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Contatti</th>
                            <th>API Keys</th>
                            <th>Stato</th>
                            <th>Data Attivazione</th>
                            <th style={{ textAlign: 'right' }}>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tenants.map(t => (
                            <tr key={t.id}>
                                <td>
                                    <div style={{ color: 'var(--researcher-green)', fontWeight: 'bold' }}>{t.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ID: {t.id}</div>
                                </td>
                                <td>
                                    <div style={{ fontSize: '0.85rem' }}>📧 {t.email}</div>
                                    <div style={{ fontSize: '0.85rem' }}>📱 {t.phoneNumber}</div>
                                </td>
                                <td>
                                    <span style={{ fontSize: '0.9rem', color: 'white', background: '#334155', padding: '2px 8px', borderRadius: '12px' }}>
                                        {t.apiKeys?.length || 0} keys
                                    </span>
                                </td>
                                <td>
                                    <span className={`tag ${t.isActive ? 'tag-success' : 'tag-danger'}`}>
                                        {t.isActive ? 'OPERATIVO' : 'SOSPESO'}
                                    </span>
                                </td>
                                <td className="text-muted" style={{ fontSize: '0.8rem' }}>
                                    {new Date(t.createdAt).toLocaleDateString()}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handleToggleStatus(t.id, t.isActive)}
                                            className="btn-primary"
                                            style={{
                                                padding: '4px 10px',
                                                fontSize: '0.7rem',
                                                minWidth: '70px',
                                                background: t.isActive ? '#475569' : 'var(--researcher-green)'
                                            }}
                                        >
                                            {t.isActive ? 'Sospendi' : 'Riattiva'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTenant(t.id, t.name)}
                                            className="btn-danger"
                                            style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                                        >
                                            Elimina
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {tenants.length === 0 && !loading && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Nessun cliente ancora attivato.</td>
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
        </div>
    );
};

export default TenantManager;
