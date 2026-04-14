const AIService = require('./aiService');
const HoneytokenService = require('./honeytokenService');

class DecoyService {
    /**
     * Determina se un percorso è "interessante" per generare un'esca AI
     */
    static isBaitWorthy(path) {
        const sensitivePatterns = [
            /\.env$/i,
            /\.config(\.(php|json|yml|yaml))?$/i,
            /backup/i,
            /sql$/i,
            /password/i,
            /admin/i,
            /db/i,
            /wp-config/i,
            /\.git/i,
            /hidden/i,
            /private/i,
            /docker-compose/i,
            /k8s/i,
            /secrets?\.(ya?ml|json)/i,
            /\.ssh/i,
            /\.kube/i,
            /credentials/i,
            /\.aws/i,
        ];
        return sensitivePatterns.some(pattern => pattern.test(path));
    }

    /**
     * First-pass: Try to serve a HoneytokenService template.
     * These are instant (no AI call) and all credentials are tracked.
     * 
     * @param {string} path - The requested file path
     * @returns {string|null} Content if a template matched, null otherwise
     */
    static _tryHoneytokenTemplate(path) {
        const lowerPath = path.toLowerCase();

        if (lowerPath.includes('.env') || lowerPath.includes('credentials')) {
            return HoneytokenService.generateEnvFile();
        }
        if (lowerPath.includes('config.json') || lowerPath.includes('settings.json')) {
            return JSON.stringify(HoneytokenService.generateConfigJson(), null, 2);
        }
        if (lowerPath.includes('docker-compose')) {
            return HoneytokenService.generateDockerCompose();
        }
        if (lowerPath.includes('k8s') || lowerPath.includes('secrets.y')) {
            return HoneytokenService.generateK8sSecrets();
        }

        return null; // No template matched, fall through to AI
    }

    /**
     * Genera il contenuto di un file finto.
     * Pipeline: HoneytokenService template → AI generation → null (fallback)
     */
    static async generateDynamicDecoy(path, method, headers = {}) {
        console.log(`[OpenAI] Corretto ingresso in DecoyService.generateDynamicDecoy per path: ${path}`);
        // Step 1: Try instant honeytoken templates
        const templateContent = this._tryHoneytokenTemplate(path);
        if (templateContent) {
            console.log(`🍯 [Decoy] Served honeytoken template for ${path}`);
            return templateContent;
        }

        // Step 2: AI-generated decoy for unusual paths
        try {
            console.log(`🤖 AI Decoy: Generating fake content for ${path}...`);

            const prompt = `
            Sei un sistema di difesa Honeypot avanzato. Un attaccante ha richiesto il file: "${path}" via ${method}.
            
            Richiesta:
            Genera il contenuto di questo file in modo che sembri ESTREMAMENTE realistico e vulnerabile, ma che sia totalmente innocuo.
            
            Linee guida:
            1. Se è un file .env o .config, includi credenziali false (es: DB_PASSWORD=admin123).
            2. Se è un file SQL, includi una struttura di tabelle fittizia (es: users, transactions).
            3. Aggiungi commenti che suggeriscano all'attaccante di cercare altri file inesistenti (es: "# TODO: spostare i backup in /hidden_backup_folder/").
            4. Mantieni il formato tecnico corretto (se finisce in .php, deve sembrare codice PHP).
            5. Non aggiungere spiegazioni, restituisci SOLO il contenuto del file.
            `;

            console.log(`[OpenAI] Chiamata AI avviata per generazione Decoy content per ${path}...`);
            let content = await AIService._generateText(prompt);

            if (!content) return null;

            // Pulisci eventuale markdown (```php ... ```)
            content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();

            return content;
        } catch (error) {
            console.error('❌ AI Decoy Generation Error:', error);
            return null; // Fallback al comportamento standard
        }
    }
}

module.exports = DecoyService;
