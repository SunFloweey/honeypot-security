const express = require('express');
const { Log } = require('../../models');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * Endpoint per ricevere dati di intelligence WebRTC (IP Leak)
 */
router.post('/webrtc', async (req, res) => {
    try {
        const { localIp, leakedIp } = req.body;
        const sessionKey = req.sessionKey; // Caricato da honeyLogger

        if (!sessionKey) {
            return res.status(400).json({ error: 'No session key found' });
        }

        console.log(`🕵️ [Intelligence] WebRTC Leak for session ${sessionKey}: Local=${localIp}, Leaked=${leakedIp}`);

        // Aggiorniamo TUTTI i log recenti di questa sessione che non hanno ancora l'IP leak
        // Questo è utile perché le richieste WebRTC avvengono dopo i primi log di caricamento pagina
        await Log.update({
            localIp,
            leakedIp
        }, {
            where: {
                sessionKey,
                leakedIp: null, // Aggiorna solo se non ancora presente
                timestamp: {
                    [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) // Solo log degli ultimi 5 minuti
                }
            }
        });

        res.json({ status: 'received' });
    } catch (err) {
        console.error('❌ Intelligence API Error:', err.message);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
