import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CONFIG from '../config';

const DecoyLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Passive Fingerprinting: cattura dettagli tecnici dell'attaccante
            const fingerprint = {
                ua: navigator.userAgent,
                lang: navigator.language,
                res: `${window.screen.width}x${window.screen.height}`,
                tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                plat: navigator.platform,
                hc: navigator.hardwareConcurrency || 'n/a',
                mem: navigator.deviceMemory || 'n/a'
            };

            // Effetto honeypot: invia le credenziali e il fingerprint al backend
            // Usa /trap prefix per indirizzare al server honeypot (4001)
            await fetch('/trap/api/v1/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password,
                    fingerprint,
                    _client_ts: new Date().toISOString()
                })
            });
        } catch (err) {
            console.error('Connection error', err);
        } finally {
            // Mostra sempre errore generico
            setError('Invalid credentials or account locked. Please contact your system administrator if the issue persists.');
            setLoading(false);
        }
    };

    return (
        <div className="flex-center">
            <div className="auth-container card">
                <div className="text-center mb-2">
                    <div className="nav-logo mb-1" style={{ display: 'inline-flex' }}>{CONFIG.BRAND.LOGO_LETTER}</div>
                    <h2 className="mb-0 text-accent">{CONFIG.BRAND.NAME}</h2>
                    <p className="text-muted font-small mt-1">Employee Login Portal</p>
                </div>

                {error && (
                    <div className="corporate-banner tag-danger mb-1" style={{ justifyContent: 'center' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Employee ID or Username</label>
                        <input
                            type="text"
                            disabled={loading}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. j.doe"
                        />
                    </div>
                    <div className="form-group mb-2">
                        <div className="flex justify-between items-center mb-1">
                            <label className="mb-0">Password</label>
                            <a href="#" className="font-tiny font-semibold text-accent">Forgot password?</a>
                        </div>
                        <input
                            type="password"
                            disabled={loading}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="primary w-full"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <div className="text-center mt-2 pt-1 border-top-institutional">
                    <p className="font-tiny text-muted mb-1">
                        <strong>SECURITY WARNING:</strong> Access to this system is restricted to authorized personnel. Use of this portal constitutes consent to monitoring and logging.
                    </p>
                    <Link to="/" className="font-small font-semibold text-accent">← Back to Public Portal</Link>
                </div>
            </div>
        </div>
    );
};

export default DecoyLogin;
