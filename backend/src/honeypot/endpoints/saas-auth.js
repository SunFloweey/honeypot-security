/**
 * Endpoint Autenticazione SaaS (Reale)
 * 
 * A differenza di auth.js (che è un endpoint ESCA per catturare attaccanti),
 * questo file gestisce l'autenticazione REALE del sistema SaaS:
 * - POST /register  → Registrazione nuovo utente
 * - POST /login     → Login e generazione JWT
 * - GET  /keys      → Lista chiavi API dell'utente
 * - POST /keys      → Genera nuova chiave API
 * - DELETE /keys/:id → Revoca una chiave API
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const ApiKey = require('../../models/ApiKey');
const Log = require('../../models/Log');
const { sequelize } = require('../../config/database');
const { adminAuthMiddleware } = require('../middleware/adminAuth');
const provisioningService = require('../utils/provisioningService');
const SdkBundleService = require('../utils/sdkBundleService');

const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_TOKEN;
const JWT_EXPIRES_IN = '7d';

/**
 * Middleware: Verifica JWT per rotte protette
 */
async function jwtAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    const adminToken = req.headers['x-admin-token'];

    // 1. Fallback per Super-Admin (ViperScan Owner)
    const GLOBAL_ADMIN_TOKEN = process.env.ADMIN_TOKEN;
    if (adminToken && GLOBAL_ADMIN_TOKEN && adminToken === GLOBAL_ADMIN_TOKEN) {
        req.user = { role: 'admin', isGlobal: true, userId: null };
        return next();
    }

    // 2. Controllo normale JWT per utenti client
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token mancante' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Controllo critico: l'utente è ancora attivo nel database?
        // Facciamo una query veloce per evitare che utenti sospesi continuino a usare la dashboard
        const userStatus = await User.findByPk(decoded.userId, { attributes: ['isActive'] });
        if (!userStatus || !userStatus.isActive) {
            return res.status(403).json({ success: false, error: 'Account sospeso o eliminato. Accesso negato.' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Token non valido o scaduto' });
    }
}

// ==========================================
// PROVISIONING (Admin Only)
// ==========================================
router.post('/provision', adminAuthMiddleware, async (req, res) => {
    const { email, name, phoneNumber } = req.body;

    if (!email || !name || !phoneNumber) {
        return res.status(400).json({
            success: false,
            error: 'Email, nome e numero di cellulare sono obbligatori per il provisioning'
        });
    }

    try {
        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Account cliente già esistente per questa email'
            });
        }

        // 1. Genera password sicura
        const temporaryPassword = provisioningService.generateSecurePassword(16);

        // 2. Crea l'utente (Hooks gestiranno l'hashing bcrypt)
        const user = await User.create({
            email,
            name,
            phoneNumber,
            password: temporaryPassword,
            role: 'user'
        });

        // 3. Genera automaticamente una prima chiave API per il cliente
        const firstKey = await ApiKey.generateForUser(user.id, 'Progetto Di Default');

        // 4. Consegna credenziali via due canali separati (Out-of-Band)
        await provisioningService.sendUsernameEmail(email, name);
        await provisioningService.sendPasswordSMS(phoneNumber, temporaryPassword);

        res.status(201).json({
            success: true,
            message: 'Provisioning completato con successo. Credenziali inviate.',
            tenant: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            temporaryPassword, // Restituiamo per comodità admin in fase di test
            instruction: 'Lo username è stato inviato via email, la password via SMS.'
        });

    } catch (error) {
        console.error('❌ [SaaS Provisioning] Errore:', error.message);
        res.status(500).json({ success: false, error: 'Errore interno durante il provisioning' });
    }
});

// Vecchia rotta /register disabilitata per sicurezza SaaS
router.post('/register', (req, res) => {
    res.status(403).json({
        success: false,
        error: 'Registrazione pubblica disabilitata. Contatta l\'amministratore per il provisioning.'
    });
});

router.get('/tenants', adminAuthMiddleware, async (req, res) => {
    try {
        const tenants = await User.findAll({
            where: { role: 'user' },
            attributes: ['id', 'email', 'name', 'phoneNumber', 'isActive', 'createdAt'],
            include: [{
                model: ApiKey,
                as: 'apiKeys',
                attributes: ['id', 'isActive']
            }],
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, tenants });
    } catch (error) {
        console.error('❌ [SaaS Admin] Errore lista tenant:', error.message);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

/**
 * PATCH /tenants/:id/status - Sospende o riattiva un cliente
 */
router.patch('/tenants/:id/status', adminAuthMiddleware, async (req, res) => {
    const { isActive } = req.body;
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'Cliente non trovato' });

        user.isActive = isActive;
        await user.save();

        res.json({ success: true, message: `Stato cliente aggiornato a ${isActive ? 'Attivo' : 'Sospeso'}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /tenants/:id - Elimina un cliente e le sue chiavi
 */
router.delete('/tenants/:id', adminAuthMiddleware, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'Cliente non trovato' });

        // 1. Trova le chiavi API del cliente
        const keys = await ApiKey.findAll({ where: { userId: user.id } });
        const keyIds = keys.map(k => k.id);

        if (keyIds.length > 0) {
            // Nullifica i log per evitare violazioni di chiavi esterne (FK)
            await Log.update({ apiKeyId: null }, { where: { apiKeyId: keyIds } });
            // Elimina le chiavi
            await ApiKey.destroy({ where: { userId: user.id } });
        }

        // 4. Elimina l'utente
        await user.destroy();

        console.log(`🗑️ [SaaS Admin] Cliente eliminato con successo: ${user.email} (ID: ${user.id})`);
        res.json({ success: true, message: 'Cliente e relative chiavi eliminati con successo' });
    } catch (error) {
        console.error('❌ [SaaS Delete] Errore critico:', error);
        res.status(500).json({ success: false, error: `Errore durante l'eliminazione: ${error.message}` });
    }
});

// ==========================================
// LOGIN
// ==========================================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email e password sono obbligatori'
        });
    }

    try {
        const user = await User.findOne({ where: { email } });
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Credenziali non valide'
            });
        }

        const isValid = await user.verifyPassword(password);
        if (!isValid) {
            return res.status(401).json({
                success: false,
                error: 'Credenziali non valide'
            });
        }

        const token = jwt.sign(
            { 
                sub: user.id, 
                userId: user.id, // Retrocompatibilità
                email: user.email, 
                role: user.role,
                scope: user.role === 'admin' ? ['admin:all'] : ['monitor:write', 'tunnel:access']
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('❌ [SaaS Auth] Errore login:', error.message);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// ==========================================
// GESTIONE CHIAVI API (Protette da JWT)
// ==========================================

/**
 * GET /keys - Lista tutte le chiavi API dell'utente
 */
router.get('/keys', jwtAuth, async (req, res) => {
    try {
        const keys = await ApiKey.findAll({
            where: { userId: req.user.userId },
            attributes: ['id', 'key', 'name', 'isActive', 'lastUsedAt', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });

        res.json({ success: true, keys });
    } catch (error) {
        console.error('❌ [SaaS Auth] Errore lista chiavi:', error.message);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

/**
 * POST /keys - Genera una nuova chiave API
 */
router.post('/keys', jwtAuth, async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            error: 'Il nome del progetto è obbligatorio'
        });
    }

    try {
        // Impedisci la creazione di chiavi se non c'è un userId (caso Super-Admin globale)
        if (!req.user.userId) {
            return res.status(403).json({
                success: false,
                error: 'Gli amministratori globali non possono avere chiavi API personali. Gestisci i clienti nella sezione Tenant.'
            });
        }

        const count = await ApiKey.count({ where: { userId: req.user.userId } });
        if (count >= 10) {
            return res.status(403).json({
                success: false,
                error: 'Limite massimo di 10 chiavi API raggiunto'
            });
        }

        const apiKey = await ApiKey.generateForUser(req.user.userId, name);

        res.status(201).json({
            success: true,
            message: `Chiave API "${name}" creata con successo`,
            apiKey: {
                id: apiKey.id,
                key: apiKey.key,
                name: apiKey.name
            }
        });

    } catch (error) {
        console.error('❌ [SaaS Auth] Errore creazione chiave:', error.message);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

/**
 * DELETE /keys/:id - Revoca (disattiva) una chiave API
 */
router.delete('/keys/:id', jwtAuth, async (req, res) => {
    try {
        const apiKey = await ApiKey.findOne({
            where: { id: req.params.id, userId: req.user.userId }
        });

        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: 'Chiave API non trovata'
            });
        }

        apiKey.isActive = false;
        await apiKey.save();

        res.json({
            success: true,
            message: `Chiave "${apiKey.name}" revocata con successo`
        });

    } catch (error) {
        console.error('❌ [SaaS Auth] Errore revoca chiave:', error.message);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

/**
 * GET /sdk-config - Restituisce lo snippet pre-configurato per il client
 */
router.get('/sdk-config', jwtAuth, async (req, res) => {
    try {
        const apiKey = await ApiKey.findOne({
            where: { userId: req.user.userId, isActive: true },
            order: [['createdAt', 'DESC']]
        });

        if (!apiKey) {
            return res.status(404).json({ success: false, error: 'Nessuna chiave API attiva trovata' });
        }

        // Determina la baseUrl dinamicamente in base a come l'utente accede alla dashboard
        // Se accede via localhost:5173 (frontend), il backend risponde su 4002/4003.
        // Dobbiamo assicurarci che l'SDK punti alla porta dell'Honeypot (4002)
        const protocol = req.protocol;
        const host = req.get('host').split(':')[0]; // Prendi l'IP/Host senza porta
        const baseUrl = process.env.BASE_URL || `${protocol}://${host}:4002`;
        
        const configSnippet = `/**
 * DIANA Honeypot Configuration
 * Generato automaticamente per: ${apiKey.name}
 */
const HoneypotClient = require('./sdk/node/HoneypotClient');

const diana = new HoneypotClient({
    apiKey: '${apiKey.key}',
    baseUrl: '${baseUrl}',
    appName: '${apiKey.name}'
});

module.exports = diana;`;

        res.json({
            success: true,
            apiKey: apiKey.key,
            projectName: apiKey.name,
            baseUrl: baseUrl,
            snippet: configSnippet
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /sdk-frameworks - Restituisce la lista dei framework supportati dall'SDK
 */
router.get('/sdk-frameworks', jwtAuth, (req, res) => {
    const frameworks = SdkBundleService.FRAMEWORKS;
    const result = Object.entries(frameworks).map(([key, val]) => ({
        id: key,
        label: val.label,
        icon: val.icon
    }));
    res.json({ success: true, frameworks: result });
});

/**
 * GET /sdk-verify - Verifica se l'SDK di un client è connesso
 * Controlla se ci sono log recenti dalla chiave API attiva
 */
router.get('/sdk-verify', jwtAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const apiKeyRecord = await ApiKey.findOne({
            where: { userId: req.user.userId, isActive: true },
            order: [['createdAt', 'DESC']]
        });

        if (!apiKeyRecord) {
            return res.json({ success: true, connected: false, reason: 'no_api_key' });
        }

        // Controlla se ci sono log recenti (ultimi 5 minuti)
        const { Op } = require('sequelize');
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        const recentLogs = await Log.count({
            where: {
                apiKeyId: apiKeyRecord.id,
                timestamp: { [Op.gte]: fiveMinutesAgo }
            }
        });

        // Controlla anche lastUsedAt della chiave
        const lastUsed = apiKeyRecord.lastUsedAt;
        const isRecentlyUsed = lastUsed && (Date.now() - new Date(lastUsed).getTime()) < 5 * 60 * 1000;

        res.json({
            success: true,
            connected: recentLogs > 0 || isRecentlyUsed,
            recentLogs,
            lastUsedAt: lastUsed,
            apiKeyName: apiKeyRecord.name
        });
    } catch (error) {
        console.error('❌ [SDK Verify] Errore:', error.message);
        res.json({ success: true, connected: false, reason: 'error' });
    }
});

/**
 * POST /sdk-download - Genera e invia il pacchetto ZIP dell'SDK personalizzato
 * Accetta parametri avanzati per la personalizzazione completa
 */
router.post('/sdk-download', jwtAuth, async (req, res) => {
    try {
        const { 
            projectName, 
            customAiKey, 
            useAutoProtect, 
            securityLevel,
            framework = 'express',
            platformUrl = '',
            sensitiveFiles,
            canaryPaths,
            baitPaths,
            selectedApiKeyId
        } = req.body;

        // Usa la chiave specificata o la più recente
        const whereClause = { userId: req.user.userId, isActive: true };
        if (selectedApiKeyId) {
            whereClause.id = selectedApiKeyId;
        }

        const apiKeyRecord = await ApiKey.findOne({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });

        if (!apiKeyRecord) {
            return res.status(404).json({ success: false, error: 'Nessuna chiave API attiva trovata' });
        }

        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

        const zipBuffer = await SdkBundleService.createZipBundle({
            apiKey: apiKeyRecord.key,
            baseUrl: baseUrl,
            appName: projectName || apiKeyRecord.name,
            framework: framework,
            platformUrl: platformUrl,
            options: {
                autoProtect: useAutoProtect !== undefined ? useAutoProtect : true,
                securityLevel: securityLevel || 'medium',
                aiKey: customAiKey || 'PLATFORM_DEFAULT',
                sensitiveFiles: sensitiveFiles || ['.env', 'config.json', 'sessions_data.json'],
                canaryPaths: canaryPaths || ['/.env.real', '/admin/config.php', '/.git/config', '/backup.sql'],
                baitPaths: baitPaths || [
                    '/shell.php', '/cmd.php', '/webshell.php', '/upload.php',
                    '/cmd.jsp', '/shell.jsp', '/cmd.asp', '/shell.aspx'
                ]
            }
        });

        // Log l'evento di download
        console.log(`📦 [SDK Download] Client ${req.user.email} ha scaricato SDK per "${projectName}" (framework: ${framework})`);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="diana-sdk-${projectName || 'bundle'}.zip"`);
        res.send(zipBuffer);

    } catch (error) {
        console.error('❌ [SDK Download] Errore:', error);
        res.status(500).json({ success: false, error: 'Errore durante la generazione del bundle' });
    }
});

module.exports = { router, jwtAuth };
