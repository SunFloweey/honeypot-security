import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import CONFIG from '../config';

// Interfaccia per il caricamento file che sembra accettare file pericolosi
const DecoyUpload = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('');
    const [uploading, setUploading] = useState(false);

    const handleUpload = (e) => {
        e.preventDefault();
        if (!file) return;

        setUploading(true);
        setStatus('');

        // Simula upload finto con latenza variabile basata su config
        const delay = CONFIG.TIMING.UPLOAD_LATENCY_MIN + Math.random() * (CONFIG.TIMING.UPLOAD_LATENCY_MAX - CONFIG.TIMING.UPLOAD_LATENCY_MIN);
        setTimeout(() => {
            setUploading(false);
            setStatus('Error: SecureCloud integration failure. Access token expired or insufficient permissions for directory /assets/deployment.');
        }, delay);
    };

    return (
        <div className="app-wrapper">
            {/* Header matches Home */}
            <nav className="nav-standard">
                <div className="nav-content">
                    <Link to="/" className="nav-brand">
                        <div className="nav-logo">{CONFIG.BRAND.LOGO_LETTER}</div>
                        <span className="font-bold">{CONFIG.BRAND.NAME}</span>
                    </Link>
                    <div className="font-small">Employee: it-admin@{CONFIG.BRAND.NAME.toLowerCase().replace(/\s/g, '')}.com</div>
                </div>
            </nav>

            <main className="main-content flex-center">
                <div className="auth-container">
                    <div className="card">
                        <h1 className="mb-1">Internal Asset Deployment</h1>
                        <p className="text-muted font-small mb-2">
                            Upload configuration patches, server scripts, or project assets to the central distribution node.
                        </p>

                        <div className="corporate-banner">
                            <span>ℹ️</span>
                            All uploaded files are subjected to automatic malware scanning and behavioral analysis.
                        </div>

                        <form onSubmit={handleUpload} className="mt-2">
                            <div className="upload-zone">
                                <input
                                    type="file"
                                    id="file-upload"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    style={{ display: 'none' }}
                                />
                                <label htmlFor="file-upload">
                                    <span className="upload-icon">📁</span>
                                    <div className="font-semibold mb-1">
                                        {file ? file.name : 'Click to select project asset'}
                                    </div>
                                    <div className="font-small text-muted">
                                        Max size: 50MB. Allowed: .zip, .sql, .js, .config
                                    </div>
                                </label>
                            </div>

                            <div className="form-group mb-2">
                                <label>Deployment Destination</label>
                                <select>
                                    <option>/etc/{CONFIG.BRAND.SHORT_NAME.toLowerCase()}/production/</option>
                                    <option>/var/www/internal-docs/</option>
                                    <option>/opt/{CONFIG.BRAND.SHORT_NAME.toLowerCase()}/project-atlas/</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={!file || uploading}
                                className="primary w-full"
                            >
                                {uploading ? 'Scanning & Deploying...' : 'Initiate Deployment'}
                            </button>
                        </form>

                        {status && (
                            <div className="corporate-banner tag-danger mt-2">
                                {status}
                            </div>
                        )}
                    </div>

                    <div className="text-center mt-2">
                        <Link to="/" className="font-small text-muted">← Back to Dashboard</Link>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DecoyUpload;
