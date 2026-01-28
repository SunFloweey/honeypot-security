import React from 'react';
import { Link } from 'react-router-dom';
import CONFIG from '../config';

// Homepage istituzionale della dashboard finta
const DecoyHome = () => {
    return (
        <div className="app-wrapper">
            {/* Top Navbar */}
            <nav className="nav-standard">
                <div className="nav-content">
                    <div className="nav-brand">
                        <div className="nav-logo">{CONFIG.BRAND.LOGO_LETTER}</div>
                        <span className="font-bold text-accent">{CONFIG.BRAND.NAME}</span>
                    </div>
                    <div className="nav-links">
                        <Link to="/" className="active">Dashboard</Link>
                        <Link to="/directory">Directory</Link>
                        <Link to="/it-support">IT Support</Link>
                        <Link to="/upload">File Upload</Link>
                        <Link to="/login">Employee Login</Link>
                    </div>
                </div>
            </nav>

            <main className="main-content standard-container">
                <div className="corporate-banner">
                    <span>⚠️</span>
                    <div>
                        <strong>RESTRICTED ACCESS:</strong> This system is for authorized {CONFIG.BRAND.NAME} employees only. All activities are logged and monitored for security purposes.
                    </div>
                </div>

                <div className="decoy-grid">
                    {/* Left Column: Welcome & Projects */}
                    <section>
                        <h1 className="mb-1">Welcome to {CONFIG.BRAND.NAME} Employee Portal</h1>
                        <p className="text-muted mb-2">
                            Access internal resources, project documentation, and secure communications from a centralized interface.
                        </p>

                        <h2 className="mb-1 border-bottom-institutional">Active Internal Projects</h2>

                        <div className="flex flex-column gap-1">
                            <div className="card">
                                <div className="flex justify-between items-center mb-1">
                                    <h3 className="mb-0 text-accent">Project Atlas</h3>
                                    <span className="tag tag-success">VERSION 2.4.1</span>
                                </div>
                                <p className="font-small text-muted mb-1">
                                    Internal server infrastructure migration and security hardening. Documentation restricted to level 3 personnel.
                                </p>
                                <div className="mt-1">
                                    <Link to="/api/docs" className="font-semibold text-accent font-small">View API Docs →</Link>
                                </div>
                            </div>

                            <div className="card">
                                <h3 className="mb-1">Q3 Financial Audit</h3>
                                <p className="font-small text-muted mb-1">
                                    Preliminary reports for the third quarter. Access requires two-factor authentication.
                                </p>
                                <div className="mt-1">
                                    <Link to="/admin" className="font-semibold text-accent font-small">Access Repository →</Link>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Right Column: Sidebar */}
                    <aside>
                        <div className="card bg-alt">
                            <h3 className="mb-1">IT Status</h3>
                            <ul className="status-list">
                                <li className="status-item">
                                    <span>VPN Gateway (Frankfurt)</span>
                                    <span className="font-bold text-success">● Online</span>
                                </li>
                                <li className="status-item">
                                    <span>Email Cluster</span>
                                    <span className="font-bold text-success">● Online</span>
                                </li>
                                <li className="status-item">
                                    <span>Legacy DB Support</span>
                                    <span className="font-bold text-danger">● Maintenance</span>
                                </li>
                            </ul>
                            <div className="mt-2 flex flex-column gap-1">
                                <Link to="/directory" className="button secondary w-full">Employee Directory</Link>
                                <Link to="/it-support" className="button secondary w-full">Submit IT Ticket</Link>
                                <Link to="/upload" className="button secondary w-full">Asset Upload (Restricted)</Link>
                            </div>
                            <hr className="mt-2 mb-1 border-mute" />
                            <button className="primary w-full">Download Global Security Policy</button>
                        </div>

                        <div className="text-center mt-2">
                            <p className="font-tiny text-muted">
                                Need help? Contact the SOC at <br />
                                <span className="font-bold text-main">{CONFIG.BRAND.SUPPORT_EMAIL}</span>
                            </p>
                        </div>
                    </aside>
                </div>
            </main>

            <footer className="decoy-footer">
                <div className="footer-content">
                    <div className="footer-links">
                        <Link to="/privacy" className="footer-link">Privacy Policy</Link>
                        <Link to="/terms" className="footer-link">Terms of Service</Link>
                        <Link to="/it-support" className="footer-link">IT Support</Link>
                        <Link to="/directory" className="footer-link">Accessibility</Link>
                    </div>

                    <div>
                        © {CONFIG.BRAND.YEAR} {CONFIG.BRAND.LEGAL_NAME} All rights reserved.<br />
                        Unauthorized access is a violation of the Computer Fraud and Abuse Act.
                    </div>

                    <div className="footer-badge">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Secured & Verified by Cloudflare</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default DecoyHome;
