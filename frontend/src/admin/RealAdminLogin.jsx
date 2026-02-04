import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RealAdminLogin = () => {
    const [token, setToken] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Verify token by making a call to the health endpoint which is protected
            const res = await fetch('/api/db-check', {
                headers: {
                    'x-admin-token': token
                }
            });

            if (res.ok) {
                localStorage.setItem('adminToken', token);
                navigate('/real-dashboard');
            } else {
                setError('Invalid Admin Token. This attempt has been logged.');
            }
        } catch (err) {
            setError('Connection failed. Is the Admin Server running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-center" style={{ backgroundColor: '#0f172a', minHeight: '100vh' }}>
            <div className="card" style={{ maxWidth: '400px', width: '100%', borderColor: '#1e293b', backgroundColor: '#1e293b' }}>
                <div className="text-center mb-2">
                    <h2 style={{ color: '#10b981' }}>🛡️ HONEYPOT ACCESS</h2>
                    <p style={{ color: '#94a3b8' }}>Security Researcher Portal</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label style={{ color: '#94a3b8' }}>Admin Token</label>
                        <input
                            type="password"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="Enter secure token..."
                            style={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #334155',
                                color: '#f8fafc',
                                padding: '0.75rem'
                            }}
                            required
                        />
                    </div>
                    {error && (
                        <div style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="primary w-full"
                        style={{ marginTop: '1.5rem', backgroundColor: '#10b981', border: 'none' }}
                    >
                        {loading ? 'Verifying...' : 'Access Dashboard'}
                    </button>
                </form>

                <div className="mt-2 text-center">
                    <p style={{ fontSize: '0.75rem', color: '#475569' }}>
                        WARNING: Unauthorized access is strictly prohibited.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RealAdminLogin;
