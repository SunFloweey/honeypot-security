const crypto = require('crypto');

/**
 * Provisioning Service
 * Gestisce la creazione sicura degli account tenant.
 */
class ProvisioningService {
    /**
     * Genera una password sicura altamente casuale
     */
    generateSecurePassword(length = 16) {
        // Caratteri permessi per evitare ambiguità (es. l, 1, O, 0 rimosse)
        const charset = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()_+';
        let password = '';
        const bytes = crypto.randomBytes(length);

        for (let i = 0; i < length; i++) {
            password += charset.charAt(bytes[i] % charset.length);
        }
        return password;
    }

    /**
     * Mock per l'invio dello username via Email
     */
    async sendUsernameEmail(email, name) {
        console.log('');
        console.log('📧 [MAILING SERVICE] Inviando credenziali via Email...');
        console.log(`To: ${email}`);
        console.log(`Subject: Benvenuto in Honeypot Security Portfolio, ${name}`);
        console.log(`Body: Il tuo account è attivo. Lo username è la tua email: ${email}`);
        console.log('----------------------------------------------------------');
        return true;
    }

    /**
     * Mock per l'invio della password via SMS
     */
    async sendPasswordSMS(phoneNumber, password) {
        console.log('');
        console.log('📱 [SMS GATEWAY] Inviando password tramite canale Out-of-Band...');
        console.log(`To: ${phoneNumber}`);
        console.log(`Message: La tua password temporanea per Honeypot Security è: ${password}`);
        console.log('----------------------------------------------------------');
        return true;
    }
}

module.exports = new ProvisioningService();
