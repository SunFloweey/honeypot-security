const rulesData = require('../../../data/rules.json');

// PRE-COMPILE REGEX PATTERNS AT MODULE LOAD
const COMPILED_RULES = rulesData.map(r => ({
    ...r,
    pattern: new RegExp(r.pattern, r.flags)
}));

class RiskEngine {
    /**
     * Checks the request against static regex rules.
     * @param {Object} req - The Express request object (with captured body/path)
     * @param {Object} logRecord - The log entity
     * @returns {Array} List of triggered classifications
     */
    static analyze(req, logRecord) {
        const classifications = [];

        // Decode URI component to catch simple bypasses (e.g. %27 instead of ')
        let decodedPath = req.path; // Use captured path
        try {
            decodedPath = decodeURIComponent(req.path);
        } catch (e) { /* ignore malformed URI */ }

        // Construct the check string
        // Note: We use the *original* request body (or redacted one available in logRecord/req)
        // Here we assume req has the same structure as passed to Classifier previously
        const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const checkString = `${decodedPath} ${bodyStr}`.toLowerCase();

        for (const rule of COMPILED_RULES) {
            if (rule.pattern.test(checkString)) {
                classifications.push({
                    logId: logRecord.id,
                    category: rule.category,
                    riskScore: rule.score,
                    patternMatched: rule.msg
                });
            }
        }

        return classifications;
    }
}

module.exports = RiskEngine;
