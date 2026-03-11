/**
 * DIANA Terminal Route - Real Terminal Execution
 * Handles real terminal commands via Docker sandbox
 */
const express = require('express');
const TerminalOrchestrator = require('../services/terminalOrchestrator');
const { authenticateApiKey } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
const terminalOrchestrator = new TerminalOrchestrator();

// Initialize sandbox on startup
terminalOrchestrator.initializeSandbox().catch(err => {
    logger.error('Failed to initialize terminal sandbox:', err);
});

/**
 * POST /api/terminal/execute
 * Execute a command in the real terminal sandbox
 */
router.post('/execute', authenticateApiKey, async (req, res) => {
    try {
        const { command, sessionId } = req.body;
        
        if (!command || !sessionId) {
            return res.status(400).json({
                error: 'Command and sessionId are required',
                timestamp: new Date().toISOString()
            });
        }

        // Get client information for logging
        const clientInfo = {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            apiKey: req.apiKey?.id || 'unknown'
        };

        // Execute command in real terminal
        const output = await terminalOrchestrator.executeCommand(sessionId, command, clientInfo);
        
        res.json({
            output,
            sessionId,
            timestamp: new Date().toISOString(),
            executionTime: Date.now()
        });

    } catch (error) {
        logger.error('Terminal execution error:', error);
        res.status(500).json({
            error: 'Command execution failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/terminal/status
 * Get sandbox container status
 */
router.get('/status', authenticateApiKey, async (req, res) => {
    try {
        const status = await terminalOrchestrator.getContainerStatus();
        res.json({
            sandbox: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Terminal status error:', error);
        res.status(500).json({
            error: 'Failed to get terminal status',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/terminal/reset
 * Reset the sandbox container
 */
router.post('/reset', authenticateApiKey, async (req, res) => {
    try {
        await terminalOrchestrator.resetContainer();
        logger.info('🔄 Terminal sandbox reset by admin');
        res.json({
            message: 'Terminal sandbox reset successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Terminal reset error:', error);
        res.status(500).json({
            error: 'Failed to reset terminal',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/terminal/history/:sessionId
 * Get command history for a session
 */
router.get('/history/:sessionId', authenticateApiKey, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const history = terminalOrchestrator.commandHistory.get(sessionId) || [];
        
        res.json({
            sessionId,
            history: history.slice(-50), // Last 50 commands
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Terminal history error:', error);
        res.status(500).json({
            error: 'Failed to get terminal history',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
