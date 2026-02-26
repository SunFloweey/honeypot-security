import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * SaaSAuth Component
 * Modern, premium authentication portal for the Honeypot platform.
 * Supports Login and Registration.
 */
const SaaSAuth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const endpoint = isLogin ? '/api/v1/saas/login' : '/api/v1/saas/register';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (data.success) {
                localStorage.setItem('saasToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                navigate('/real-dashboard');
            } else {
                setError(data.error || 'Autenticazione fallita.');
            }
        } catch (err) {
            setError('Impossibile connettersi al server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <style>{`
                .auth-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(circle at top right, #1e293b, #0f172a);
                    font-family: 'Outfit', sans-serif;
                    padding: 2rem;
                }
                .auth-card {
                    background: rgba(30, 41, 59, 0.7);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    padding: 3rem;
                    width: 100%;
                    max-width: 480px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    animation: fadeIn 0.6s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .auth-header {
                    text-align: center;
                    margin-bottom: 2.5rem;
                }
                .auth-logo {
                    font-size: 3rem;
                    margin-bottom: 0.5rem;
                    display: inline-block;
                    filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.4));
                }
                .auth-title {
                    color: #fff;
                    font-size: 1.75rem;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                }
                .auth-subtitle {
                    color: #94a3b8;
                    font-size: 0.875rem;
                    margin-top: 0.5rem;
                }
                .form-group {
                    margin-bottom: 1.5rem;
                }
                .form-group label {
                    display: block;
                    color: #94a3b8;
                    margin-bottom: 0.5rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                .form-input {
                    width: 100%;
                    background: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 12px;
                    padding: 0.875rem 1rem;
                    color: #f8fafc;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .form-input:focus {
                    outline: none;
                    border-color: #10b981;
                    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
                }
                .auth-btn {
                    width: 100%;
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    padding: 1rem;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                    margin-top: 1rem;
                }
                .auth-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.4);
                }
                .auth-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .auth-switch {
                    text-align: center;
                    margin-top: 2rem;
                    color: #94a3b8;
                    font-size: 0.875rem;
                }
                .switch-link {
                    color: #10b981;
                    font-weight: 600;
                    cursor: pointer;
                    margin-left: 0.5rem;
                    text-decoration: none;
                }
                .error-box {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #f87171;
                    padding: 1rem;
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                    font-size: 0.875rem;
                    text-align: center;
                }
            `}</style>

            <div className="auth-card">
                <div className="auth-header">
                    <img
                        src="/viperscan-logo.png"
                        alt="ViperScan Logo"
                        className="auth-logo-img"
                        style={{
                            width: '120px',
                            height: 'auto',
                            marginBottom: '1.5rem',
                            filter: 'drop-shadow(0 0 20px rgba(16, 185, 129, 0.4))'
                        }}
                    />
                    <h1 className="auth-title">ViperScan Intelligence</h1>
                    <p className="auth-subtitle">
                        {isLogin ? 'Accedi al portale di cyber-security' : 'Configura il tuo scudo oggi'}
                    </p>
                </div>

                {error && <div className="error-box">{error}</div>}

                <form onSubmit={handleAuth}>
                    {!isLogin && (
                        <div className="form-group">
                            <label>Nome Completo</label>
                            <input
                                type="text"
                                name="name"
                                className="form-input"
                                placeholder="Mario Rossi"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Indirizzo Email</label>
                        <input
                            type="email"
                            name="email"
                            className="form-input"
                            placeholder="mario@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? 'Elaborazione...' : isLogin ? 'Accedi' : 'Registrati'}
                    </button>
                </form>

                <div className="auth-switch">
                    {isLogin ? 'Non hai un account?' : 'Hai già un account?'}
                    <span className="switch-link" onClick={() => setIsLogin(!isLogin)}>
                        {isLogin ? 'Crea Account' : 'Accedi'}
                    </span>
                    <div style={{ marginTop: '1.5rem', opacity: 0.5 }}>
                        <span
                            onClick={() => navigate('/researcher-login')}
                            style={{ cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                        >
                            Researcher Access
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaaSAuth;
