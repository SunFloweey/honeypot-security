import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import CONFIG from '../config';

const MaintenancePage = ({ title, code, message }) => {
    const location = useLocation();

    return (
        <div className="app-wrapper">
            <nav className="nav-standard">
                <div className="nav-content">
                    <Link to="/" className="nav-brand">
                        <div className="nav-logo">{CONFIG.BRAND.LOGO_LETTER}</div>
                        <span className="font-bold">{CONFIG.BRAND.NAME}</span>
                    </Link>
                </div>
            </nav>

            <main className="main-content flex-center flex-column">
                <div className="card text-center" style={{ maxWidth: '600px', width: '90%' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>🛰️</div>
                    <h1 className="mb-1">{title || 'Resource Unavailable'}</h1>

                    {code && (
                        <div className="monospace text-muted mb-2" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>
                            STATUS_CODE: {code}
                        </div>
                    )}

                    <div className="corporate-banner tag-warning justify-center mb-2">
                        {message || 'This internal resource is currently undergoing scheduled maintenance.'}
                    </div>

                    <p className="text-muted font-small">
                        If you believe this is an error or require urgent access, please contact the IT Service Desk at <span className="font-bold">{CONFIG.BRAND.SUPPORT_EXT}</span> or open a priority ticket.
                    </p>

                    <div className="mt-2 pt-2 border-top-institutional">
                        <Link to="/" className="button outline w-full">← Return to Employee Portal</Link>
                    </div>
                </div>

                <p className="font-tiny text-muted mt-2" style={{ opacity: 0.6 }}>
                    Request ID: {Math.random().toString(36).substring(7).toUpperCase()} | Node: GT-SO-0{Math.floor(Math.random() * 9)}
                </p>
            </main>

            <footer className="decoy-footer">
                <div className="footer-content">
                    <div>© {CONFIG.BRAND.YEAR} {CONFIG.BRAND.LEGAL_NAME} Security & Infrastructure</div>
                </div>
            </footer>
        </div>
    );
};

export default MaintenancePage;
