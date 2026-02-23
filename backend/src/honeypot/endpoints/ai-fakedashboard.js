const express = require('express');
const router = express.Router();
const AIService = require('../../services/aiService');

// Rotte specifiche che l'hacker colpirà
router.all(['/users', '/admin', '/login'], async (req, res) => {
    try {
        console.log(`[AI-DECEPTION] Generando risposta per: ${req.path}`);

        // Chiamiamo il Metodo B (Inganno)
        const fakeData = await AIService.getDeceptiveResponse(req);

        // Simuliamo un leggero ritardo per realismo
        const delay = Math.floor(Math.random() * (1500 - 500) + 500);

        setTimeout(() => {
            res.status(200).json(fakeData);
        }, delay);

    } catch (error) {
        console.error("Errore Generazione IA:", error);
        res.status(200).json({ error: "Internal Server Error", message: "SQL syntax error near 'JOIN'..." });
    }
});

module.exports = router;