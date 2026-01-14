const Log = require('../../models/Log');
const Classification = require('../../models/Classification');
const { Op } = require('sequelize');

class Classifier {
    /**
     * Esegue la classificazione completa di un log
     */
    static async classify(req, logRecord, session) {
        const classifications = [];
        const checkString = `${req.originalUrl} ${JSON.stringify(req.body)}`.toLowerCase();

        // 1. Regole Statiche (Regex)
        const staticRules = [
            { category: 'recon', score: 20, pattern: /\/admin|\/wp-admin|\/phpmyadmin|\/\.env|\/\.git|\/config/i, msg: 'Accesso a path sensibili (Recon)' },
            { category: 'injection', score: 50, pattern: /'|"|;|--|\bunion\b|\bselect\b|\bdrop\b|\balert\(|<script/i, msg: 'Pattern Injection rilevato' },
            { category: 'path_traversal', score: 50, pattern: /\.\.\/|\.\.\\|etc\/passwd|windows\/system32/i, msg: 'Tentativo Path Traversal' },
            { category: 'xxe', score: 40, pattern: /<!entity|<!doctype/i, msg: 'Tentativo XXE' }
        ];

        for (const rule of staticRules) {
            if (rule.pattern.test(checkString)) {
                classifications.push({
                    log_id: logRecord.id,
                    category: rule.category,
                    risk_score: rule.score,
                    pattern_matched: rule.msg
                });
            }
        }

        // 2. Analisi Comportamentale (Stateful)

        // Brute Force Detection (POST /login ripetuti)
        if (req.method === 'POST' && (req.path === '/login' || req.path === '/wp-login.php')) {
            const recentLogins = await Log.count({
                where: {
                    session_key: req.session_key,
                    path: req.path,
                    method: 'POST',
                    timestamp: { [Op.gt]: new Date(Date.now() - 5 * 60 * 1000) } // ultimi 5 minuti
                }
            });
            if (recentLogins > 3) {
                classifications.push({
                    log_id: logRecord.id,
                    category: 'brute_force',
                    risk_score: 40,
                    pattern_matched: `Multipli tentativi di login (${recentLogins}) in breve tempo`
                });
            }
        }

        // Automation Detection (Alta frequenza)
        const recentRequests = await Log.count({
            where: {
                session_key: req.session_key,
                timestamp: { [Op.gt]: new Date(Date.now() - 1 * 60 * 1000) } // ultimo minuto
            }
        });
        if (recentRequests > 15) {
            classifications.push({
                log_id: logRecord.id,
                category: 'automation',
                risk_score: 30,
                pattern_matched: `Alta frequenza di richieste (${recentRequests}/min)`
            });
        }

        // Salvataggio nel DB
        if (classifications.length > 0) {
            await Classification.bulkCreate(classifications);

            // Calcolo Risk Score Totale della Sessione (Somma pesata, clamp 0-100)
            await this.updateSessionRisk(session, classifications);
        }

        return classifications;
    }

    /**
     * Aggiorna il punteggio di rischio della sessione
     */
    static async updateSessionRisk(session, newClassifications) {
        // Recuperiamo tutte le categorie uniche rilevate finora per questa sessione per evitare duplicati nel calcolo del peso base,
        // oppure sommiamo semplicemente i nuovi se vogliamo un accumulo. 
        // La roadmap dice "Somma pesata", quindi accumuliamo ma limitiamo a 100.

        let addedRisk = 0;
        newClassifications.forEach(c => {
            addedRisk += c.risk_score;
        });

        const newTotal = Math.min(100, (session.max_risk_score || 0) + addedRisk);
        await session.update({ max_risk_score: newTotal });
    }
}

module.exports = Classifier;
