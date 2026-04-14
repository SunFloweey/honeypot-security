import React, { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

/**
 * OnboardingWizard - Wizard avanzato per la configurazione e il download dell'SDK DIANA
 * 
 * Flusso in 5 step:
 * 1. Informazioni Piattaforma (nome, framework, URL)
 * 2. Selezione/Creazione Chiave API
 * 3. Configurazione Sicurezza (livello, auto-protect, file sensibili)
 * 4. Anteprima + Download SDK personalizzato
 * 5. Verifica Connessione
 */
const OnboardingWizard = ({ onComplete }) => {
    const { getToken } = useAdminAuth();
    const [step, setStep] = useState(1);
    const TOTAL_STEPS = 3;

    // Dati dal server
    const [config, setConfig] = useState(null);
    const [apiKeys, setApiKeys] = useState([]);
    const [frameworks, setFrameworks] = useState([]);
    
    // Loading states
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null);
    const [creatingKey, setCreatingKey] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [showNewKeyInput, setShowNewKeyInput] = useState(false);
    const [downloadComplete, setDownloadComplete] = useState(false);
    
    // Preferenze utente
    const [userPrefs, setUserPrefs] = useState({
        projectName: '',
        platformUrl: '',
        framework: 'express',
        selectedApiKeyId: '',
        selectedApiKey: '',
        customAiKey: '',
        useAutoProtect: true,
        securityLevel: 'medium',
        sensitiveFiles: ['.env', 'config.json', 'sessions_data.json'],
        canaryPaths: ['/.env.real', '/admin/config.php', '/.git/config', '/backup.sql'],
        baitPaths: ['/shell.php', '/cmd.php', '/webshell.php', '/upload.php']
    });

    // Custom inputs per file aggiuntivi
    const [newSensitiveFile, setNewSensitiveFile] = useState('');
    const [newCanaryPath, setNewCanaryPath] = useState('');
    const [newBaitPath, setNewBaitPath] = useState('');

    // Fetch dati iniziali
    useEffect(() => {
        const fetchInitialData = async () => {
            const token = getToken();
            try {
                const [configRes, keysRes, fwRes] = await Promise.all([
                    fetch('/api/v1/saas/sdk-config', { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch('/api/v1/saas/keys', { headers: { 'Authorization': `Bearer ${token}` } }),
                    fetch('/api/v1/saas/sdk-frameworks', { headers: { 'Authorization': `Bearer ${token}` } })
                ]);

                const configData = await configRes.json();
                const keysData = await keysRes.json();
                const fwData = await fwRes.json();

                if (configData.success) {
                    setConfig(configData);
                    setUserPrefs(prev => ({ 
                        ...prev, 
                        projectName: configData.projectName || '' 
                    }));
                }

                if (keysData.success && keysData.keys) {
                    const activeKeys = keysData.keys.filter(k => k.isActive);
                    setApiKeys(activeKeys);
                    if (activeKeys.length > 0) {
                        setUserPrefs(prev => ({
                            ...prev,
                            selectedApiKeyId: activeKeys[0].id,
                            selectedApiKey: activeKeys[0].key
                        }));
                    }
                }

                if (fwData.success) {
                    setFrameworks(fwData.frameworks);
                }
            } catch (err) {
                console.error('Errore caricamento config onboarding:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Crea nuova chiave API
    const createApiKey = async () => {
        if (!newKeyName.trim()) return;
        setCreatingKey(true);
        try {
            const token = getToken();
            const res = await fetch('/api/v1/saas/keys', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKeyName.trim() })
            });
            const data = await res.json();
            if (data.success) {
                const newKey = data.apiKey;
                setApiKeys(prev => [...prev, { ...newKey, isActive: true }]);
                setUserPrefs(prev => ({ 
                    ...prev, 
                    selectedApiKeyId: newKey.id, 
                    selectedApiKey: newKey.key,
                    projectName: prev.projectName || newKey.name
                }));
                setNewKeyName('');
                setShowNewKeyInput(false);
            }
        } catch (err) {
            console.error('Errore creazione chiave:', err);
        } finally {
            setCreatingKey(false);
        }
    };

    // Download SDK
    const downloadSdk = async () => {
        setDownloading(true);
        try {
            const token = getToken();
            const res = await fetch('/api/v1/saas/sdk-download', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...userPrefs,
                    selectedApiKeyId: userPrefs.selectedApiKeyId
                })
            });

            if (!res.ok) throw new Error('Download fallito');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diana-sdk-${userPrefs.projectName || 'bundle'}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setDownloadComplete(true);
        } catch (err) {
            alert('Errore durante il download dell\'SDK: ' + err.message);
        } finally {
            setDownloading(false);
        }
    };

    // Verifica connessione SDK
    const verifyConnection = useCallback(async () => {
        setVerifying(true);
        setVerifyResult(null);
        try {
            const token = getToken();
            const res = await fetch('/api/v1/saas/sdk-verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setVerifyResult(data);
        } catch (err) {
            setVerifyResult({ connected: false, reason: 'network_error' });
        } finally {
            setVerifying(false);
        }
    }, [getToken]);

    // Auto-verifica quando si arriva allo step 5
    useEffect(() => {
        if (step === 5) {
            verifyConnection();
        }
    }, [step, verifyConnection]);

    // Helpers
    const addToList = (key, value, setter) => {
        if (!value.trim()) return;
        setUserPrefs(prev => ({
            ...prev,
            [key]: [...(prev[key] || []), value.trim()]
        }));
        setter('');
    };

    const removeFromList = (key, index) => {
        setUserPrefs(prev => ({
            ...prev,
            [key]: prev[key].filter((_, i) => i !== index)
        }));
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    // Validazione step
    const canProceed = () => {
        switch (step) {
            case 1: return userPrefs.projectName.trim().length > 0;
            case 2: return userPrefs.selectedApiKeyId !== '';
            case 3: return true;
            case 4: return true; // CLI/Modern flow doesn't require download to proceed
            case 5: return true;
            default: return true;
        }
    };

    // Genera l'anteprima del codice di integrazione
    const generateIntegrationPreview = () => {
        const fw = userPrefs.framework;
        switch (fw) {
            case 'express':
                return `// app.js - Express.js
const express = require('express');
const app = express();
const Honeypot = require('@honeypot/sdk');

// ✅ Inizializzazione automatica (usa .env generato dalla CLI)
const sdk = new Honeypot();
app.use(sdk.monitor());

app.listen(3000);`;
            case 'nextjs':
                return `// lib/honeypot.js - Next.js
import Honeypot from '@honeypot/sdk';
export const sdk = new Honeypot();

// In pages/api/example.js
import { sdk } from '../../lib/honeypot';
export default sdk.wrap(async (req, res) => {
    res.json({ success: true });
});`;
            default:
                return `// Uso generico
const Honeypot = require('@honeypot/sdk');
const sdk = new Honeypot();

// Traccia un evento manuale
await sdk.trackEvent('SECURITY_CHECK', { user: 'admin', action: 'login' });`;
        }
    };

    if (loading) {
        return (
            <div className="flex-center" style={{ minHeight: '400px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spin-loader" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: '#10b981' }}>Inizializzazione ambiente sicuro...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="onboarding-wizard" style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
            <style>{`
                .onboarding-wizard {
                    animation: wizardFadeIn 0.5s ease-out;
                }
                @keyframes wizardFadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes stepSlideIn {
                    from { opacity: 0; transform: translateX(30px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .wizard-step-content {
                    animation: stepSlideIn 0.4s ease-out;
                }
                .wizard-card {
                    background: rgba(15, 23, 42, 0.95);
                    border: 1px solid rgba(16, 185, 129, 0.15);
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 
                                inset 0 1px 0 rgba(16, 185, 129, 0.1);
                }
                .wizard-top-bar {
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05));
                    padding: 1.5rem 2rem;
                    border-bottom: 1px solid rgba(16, 185, 129, 0.1);
                }
                .wizard-body {
                    padding: 2rem;
                    min-height: 420px;
                }
                .wizard-footer {
                    padding: 1.5rem 2rem;
                    border-top: 1px solid rgba(16, 185, 129, 0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(16, 185, 129, 0.03);
                }
                .step-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    position: relative;
                }
                .step-dot {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.8rem;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    z-index: 2;
                }
                .step-dot.active {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: #000;
                    box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
                    transform: scale(1.15);
                }
                .step-dot.complete {
                    background: #059669;
                    color: #000;
                }
                .step-dot.pending {
                    background: #1e293b;
                    color: #475569;
                    border: 1px solid #334155;
                }
                .step-connector {
                    width: 30px;
                    height: 2px;
                    transition: background 0.4s;
                }
                .step-connector.active {
                    background: linear-gradient(90deg, #10b981, #059669);
                }
                .step-connector.pending {
                    background: #334155;
                }
                .wiz-input {
                    width: 100%;
                    background: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 10px;
                    padding: 0.75rem 1rem;
                    color: #f8fafc;
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .wiz-input:focus {
                    outline: none;
                    border-color: #10b981;
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
                }
                .wiz-input::placeholder {
                    color: #475569;
                }
                .wiz-label {
                    display: block;
                    color: #94a3b8;
                    margin-bottom: 0.4rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .wiz-btn {
                    padding: 0.75rem 1.5rem;
                    border-radius: 10px;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.25s;
                    font-size: 0.9rem;
                }
                .wiz-btn-primary {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: #000;
                }
                .wiz-btn-primary:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.35);
                }
                .wiz-btn-primary:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                    transform: none;
                }
                .wiz-btn-secondary {
                    background: #1e293b;
                    color: #94a3b8;
                    border: 1px solid #334155;
                }
                .wiz-btn-secondary:hover {
                    border-color: #475569;
                    color: #f8fafc;
                }
                .wiz-btn-download {
                    background: linear-gradient(135deg, #10b981, #047857);
                    color: #000;
                    padding: 1rem 2rem;
                    font-size: 1.1rem;
                    border-radius: 12px;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }
                .wiz-btn-download:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 35px rgba(16, 185, 129, 0.4);
                }
                .framework-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 10px;
                }
                .framework-card {
                    background: #0f172a;
                    border: 2px solid #1e293b;
                    border-radius: 12px;
                    padding: 1rem;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .framework-card:hover {
                    border-color: #334155;
                    transform: translateY(-2px);
                }
                .framework-card.selected {
                    border-color: #10b981;
                    background: rgba(16, 185, 129, 0.08);
                    box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);
                }
                .framework-card .fw-icon {
                    font-size: 2rem;
                    margin-bottom: 0.5rem;
                }
                .framework-card .fw-label {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    font-weight: 600;
                }
                .apikey-card {
                    background: #0f172a;
                    border: 2px solid #1e293b;
                    border-radius: 10px;
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                    transition: all 0.25s;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .apikey-card:hover {
                    border-color: #334155;
                }
                .apikey-card.selected {
                    border-color: #10b981;
                    background: rgba(16, 185, 129, 0.05);
                }
                .tag-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 0.5rem;
                }
                .tag-item {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    border-radius: 6px;
                    padding: 3px 10px;
                    font-size: 0.75rem;
                    color: #10b981;
                    font-family: monospace;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .tag-remove {
                    cursor: pointer;
                    opacity: 0.6;
                    font-size: 0.85rem;
                }
                .tag-remove:hover {
                    opacity: 1;
                    color: #f87171;
                }
                .code-preview {
                    background: #020617;
                    border: 1px solid #1e293b;
                    border-radius: 10px;
                    padding: 1rem;
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 0.8rem;
                    color: #10b981;
                    overflow-x: auto;
                    position: relative;
                    line-height: 1.6;
                }
                .code-preview .code-copy-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: #1e293b;
                    border: 1px solid #334155;
                    color: #94a3b8;
                    border-radius: 6px;
                    padding: 4px 10px;
                    font-size: 0.7rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .code-preview .code-copy-btn:hover {
                    background: #334155;
                    color: #f8fafc;
                }
                .verify-circle {
                    width: 140px;
                    height: 140px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 2rem auto;
                    font-size: 3rem;
                    transition: all 0.5s;
                }
                .verify-circle.scanning {
                    border: 4px solid rgba(16, 185, 129, 0.3);
                    animation: verifyPulse 1.5s infinite;
                }
                .verify-circle.success {
                    border: 4px solid #10b981;
                    background: rgba(16, 185, 129, 0.1);
                    box-shadow: 0 0 40px rgba(16, 185, 129, 0.3);
                }
                .verify-circle.waiting {
                    border: 4px solid #f59e0b;
                    background: rgba(245, 158, 11, 0.05);
                }
                .verify-circle.error {
                    border: 4px solid #ef4444;
                    background: rgba(239, 68, 68, 0.05);
                }
                @keyframes verifyPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3); }
                    50% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }
                @media (max-width: 600px) {
                    .info-grid { grid-template-columns: 1fr; }
                    .framework-grid { grid-template-columns: repeat(2, 1fr); }
                }
                .security-option {
                    background: #0f172a;
                    border: 1px solid #1e293b;
                    border-radius: 10px;
                    padding: 0.75rem 1rem;
                    cursor: pointer;
                    transition: all 0.25s;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .security-option:hover {
                    border-color: #334155;
                }
                .security-option.selected {
                    border-color: #10b981;
                    background: rgba(16, 185, 129, 0.05);
                }
                .security-badge {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.65rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .spin-loader {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #1e293b;
                    border-top-color: #10b981;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .section-divider {
                    border: none;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.2), transparent);
                    margin: 1.5rem 0;
                }
                .wiz-section-title {
                    font-size: 0.75rem;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 0.75rem;
                    font-weight: 700;
                }
                .tag-input-row {
                    display: flex;
                    gap: 8px;
                    margin-top: 0.4rem;
                }
                .tag-input-row .wiz-input {
                    flex: 1;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.8rem;
                }
                .tag-input-row button {
                    background: rgba(16, 185, 129, 0.15);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    color: #10b981;
                    border-radius: 8px;
                    padding: 0 12px;
                    cursor: pointer;
                    font-weight: 700;
                    transition: all 0.2s;
                }
                .tag-input-row button:hover {
                    background: rgba(16, 185, 129, 0.25);
                }
                .bundle-contents {
                    background: #020617;
                    border: 1px solid #1e293b;
                    border-radius: 10px;
                    padding: 1rem;
                    margin: 1rem 0;
                }
                .bundle-file {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 0;
                    font-size: 0.8rem;
                    font-family: monospace;
                    color: #94a3b8;
                }
                .bundle-file .file-icon {
                    color: #10b981;
                }
                .bundle-file .file-desc {
                    color: #475569;
                    font-size: 0.7rem;
                    font-family: sans-serif;
                }
            `}</style>

            <div className="wizard-card">
                {/* Top Bar */}
                <div className="wizard-top-bar">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.3rem', fontWeight: 700 }}>
                                🛡️ Attivazione Scudo DIANA
                            </h2>
                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                                Configura e scarica il tuo SDK di protezione personalizzato
                            </p>
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.75rem' }}>
                            Step {step} di {TOTAL_STEPS}
                        </div>
                    </div>

                    {/* Step Indicator */}
                    <div className="step-indicator" style={{ marginTop: '1.2rem', justifyContent: 'center' }}>
                        {[
                            { n: 1, icon: '📦', label: 'Installazione' },
                            { n: 2, icon: '💻', label: 'Integrazione' },
                            { n: 3, icon: '📡', label: 'Verifica' }
                        ].map((s, i) => (
                            <React.Fragment key={s.n}>
                                {i > 0 && (
                                    <div className={`step-connector ${step > s.n - 1 ? 'active' : 'pending'}`} />
                                )}
                                <div
                                    className={`step-dot ${step === s.n ? 'active' : step > s.n ? 'complete' : 'pending'}`}
                                    title={s.label}
                                >
                                    {step > s.n ? '✓' : s.icon}
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="wizard-body">
                    {/* =============== STEP 1: CLI Setup =============== */}
                    {step === 1 && (
                        <div className="wizard-step-content">
                            <h3 style={{ color: '#f8fafc', marginBottom: '0.3rem' }}>
                                📦 Installazione tramite CLI
                            </h3>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                                Configura il tuo ambiente in pochi secondi usando il nostro terminal provisioning tool.
                            </p>

                            <div className="bundle-contents" style={{ padding: '1.2rem', background: '#020617' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <div className="wiz-section-title" style={{ color: '#10b981', fontSize: '0.7rem' }}>1. Installa il Provisioning Tool</div>
                                    <div className="code-preview" style={{ padding: '0.75rem' }}>
                                        <button className="code-copy-btn" onClick={() => copyToClipboard('npm install -g honeypot-cli')}>📋</button>
                                        <code style={{ fontSize: '0.85rem' }}>npm install -g honeypot-cli</code>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                    <div className="wiz-section-title" style={{ color: '#10b981', fontSize: '0.7rem' }}>2. Autenticati e Configura</div>
                                    <p style={{ color: '#475569', fontSize: '0.7rem', marginBottom: '0.4rem' }}>Esegui nella root del tuo progetto:</p>
                                    <div className="code-preview" style={{ padding: '0.75rem', marginBottom: '0.5rem' }}>
                                        <button className="code-copy-btn" onClick={() => copyToClipboard('honeypot-cli login')}>📋</button>
                                        <code style={{ fontSize: '0.85rem' }}>honeypot-cli login</code>
                                    </div>
                                    <div className="code-preview" style={{ padding: '0.75rem' }}>
                                        <button className="code-copy-btn" onClick={() => copyToClipboard('honeypot-cli provision')}>📋</button>
                                        <code style={{ fontSize: '0.85rem' }}>honeypot-cli provision</code>
                                    </div>
                                </div>

                                <div>
                                    <div className="wiz-section-title" style={{ color: '#10b981', fontSize: '0.7rem' }}>3. Aggiungi il pacchetto SDK</div>
                                    <div className="code-preview" style={{ padding: '0.75rem' }}>
                                        <button className="code-copy-btn" onClick={() => copyToClipboard('npm install @honeypot/sdk')}>📋</button>
                                        <code style={{ fontSize: '0.85rem' }}>npm install @honeypot/sdk</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* =============== STEP 2: Integrazione Codice =============== */}
                    {step === 2 && (
                        <div className="wizard-step-content">
                            <h3 style={{ color: '#f8fafc', marginBottom: '0.3rem' }}>
                                💻 Integrazione nel Codice
                            </h3>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                                Copia questo snippet nel file principale del tuo server.
                            </p>

                            <div className="wiz-section-title">Framework Selezionato</div>
                            <div className="framework-grid" style={{ marginBottom: '1.5rem' }}>
                                {(frameworks.length > 0 ? frameworks : [
                                    { id: 'express', label: 'Express.js', icon: '🟢' },
                                    { id: 'nextjs', label: 'Next.js', icon: '▲' },
                                    { id: 'generic', label: 'Generico', icon: '📦' }
                                ]).map(fw => (
                                    <div
                                        key={fw.id}
                                        className={`framework-card ${userPrefs.framework === fw.id ? 'selected' : ''}`}
                                        style={{ padding: '0.5rem' }}
                                        onClick={() => setUserPrefs({ ...userPrefs, framework: fw.id })}
                                    >
                                        <div className="fw-icon" style={{ fontSize: '1.2rem' }}>{fw.icon}</div>
                                        <div className="fw-label" style={{ fontSize: '0.7rem' }}>{fw.label}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="code-preview">
                                <button className="code-copy-btn" onClick={() => copyToClipboard(generateIntegrationPreview())}>
                                    📋 Copia
                                </button>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>{generateIntegrationPreview()}</pre>
                            </div>
                        </div>
                    )}

                    {/* =============== STEP 3: Verifica Connessione =============== */}
                    {step === 3 && (
                        <div className="wizard-step-content" style={{ textAlign: 'center' }}>
                            <h3 style={{ color: '#f8fafc', marginBottom: '0.3rem' }}>
                                📡 Verifica Connessione
                            </h3>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                Avvia il tuo server con l'SDK integrato. DIANA sta aspettando il primo segnale.
                            </p>

                            <div className={`verify-circle ${
                                verifying ? 'scanning' : 
                                verifyResult?.connected ? 'success' : 
                                verifyResult ? 'waiting' : 'scanning'
                            }`}>
                                {verifying ? '🔍' : 
                                 verifyResult?.connected ? '✅' : 
                                 verifyResult ? '⏳' : '🛰️'}
                            </div>

                            {verifying && (
                                <p style={{ color: '#10b981', fontSize: '0.9rem' }}>
                                    Scansione in corso...
                                </p>
                            )}

                            {verifyResult && !verifying && (
                                <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                                    {verifyResult.connected ? (
                                        <div style={{
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            borderRadius: '12px',
                                            padding: '1.5rem',
                                            marginBottom: '1rem'
                                        }}>
                                            <div style={{ fontSize: '1.2rem', color: '#10b981', fontWeight: 700, marginBottom: '0.5rem' }}>
                                                🎉 Connessione Stabilita!
                                            </div>
                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                                                DIANA sta ricevendo dati da "{verifyResult.apiKeyName || userPrefs.projectName}".
                                                {verifyResult.recentLogs > 0 && ` (${verifyResult.recentLogs} eventi recenti)`}
                                            </p>
                                        </div>
                                    ) : (
                                        <div style={{
                                            background: 'rgba(245, 158, 11, 0.08)',
                                            border: '1px solid rgba(245, 158, 11, 0.2)',
                                            borderRadius: '12px',
                                            padding: '1.5rem',
                                            marginBottom: '1rem'
                                        }}>
                                            <div style={{ fontSize: '1rem', color: '#f59e0b', fontWeight: 700, marginBottom: '0.5rem' }}>
                                                ⏳ In Attesa di Connessione
                                            </div>
                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1rem' }}>
                                                Non abbiamo ancora ricevuto segnali. Assicurati di aver:
                                            </p>
                                            <ul style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'left', lineHeight: '1.8' }}>
                                                <li>Estratto l'SDK nella root del progetto</li>
                                                <li>Eseguito <code style={{ color: '#10b981' }}>cd diana-sdk && npm install</code></li>
                                                <li>Aggiunto il middleware nel tuo server</li>
                                                <li>Avviato il server con <code style={{ color: '#10b981' }}>npm start</code></li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '1rem' }}>
                                <button
                                    className="wiz-btn wiz-btn-secondary"
                                    onClick={verifyConnection}
                                    disabled={verifying}
                                >
                                    🔄 Ricontrolla
                                </button>
                                <button
                                    className="wiz-btn wiz-btn-primary"
                                    onClick={onComplete}
                                >
                                    {verifyResult?.connected ? '🚀 Vai alla Dashboard' : 'Salta e vai alla Dashboard →'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step < 3 && (
                    <div className="wizard-footer">
                        <button
                            className="wiz-btn wiz-btn-secondary"
                            onClick={() => setStep(s => Math.max(1, s - 1))}
                            disabled={step === 1}
                            style={{ visibility: step === 1 ? 'hidden' : 'visible' }}
                        >
                            ← Indietro
                        </button>

                        <div style={{ color: '#475569', fontSize: '0.75rem' }}>
                            {step === 1 && 'Installa la CLI'}
                            {step === 2 && 'Integra l\'SDK'}
                        </div>

                        <button
                            className="wiz-btn wiz-btn-primary"
                            onClick={() => setStep(s => Math.min(TOTAL_STEPS, s + 1))}
                        >
                            {step === 2 ? 'Verifica Connessione →' : 'Avanti →'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OnboardingWizard;
