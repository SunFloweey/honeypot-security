/**
 * DIANA Browser Security SDK - v1.0.0
 * Deceptive Infrastructure & Active Network Armor
 * 
 * Leggera libreria per il monitoraggio di eventi di sicurezza lato Client.
 */
(function(window) {
    'use strict';

    function DianaBrowser(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'http://localhost:4002';
        this.appName = config.appName || 'BrowserApp';
        this.sessionKey = this._generateSessionKey();
        
        console.log('🛡️  [DIANA] Browser Security SDK Inizializzato per "' + this.appName + '"');
    }

    DianaBrowser.prototype.trackEvent = async function(event, metadata) {
        const payload = {
            event: event,
            metadata: metadata || {},
            sessionKey: this.sessionKey,
            ipAddress: 'client-side', // Verrà sovrascritto dal server se necessario
            timestamp: new Date().toISOString()
        };

        try {
            const response = await fetch(this.baseUrl + '/api/v1/sdk/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'x-app-name': this.appName,
                    'is-browser': 'true'
                },
                body: JSON.stringify(payload)
            });

            return await response.json();
        } catch (error) {
            // Silenzioso in produzione per non rompere l'esperienza utente
            console.error('[DIANA] Error tracking event:', error.message);
        }
    };

    /**
     * Monitora tentativi di Login
     * @param {string} formId - L'ID del form HTML di login
     */
    DianaBrowser.prototype.monitorLoginForm = function(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', (e) => {
            const formData = new FormData(form);
            const user = formData.get('username') || formData.get('email') || 'unknown';
            
            this.trackEvent('LOGIN_SUBMIT', {
                formId: formId,
                user: user,
                path: window.location.pathname
            });
        });
    };

    /**
     * Genera una session key persistente per la sessione del browser
     */
    DianaBrowser.prototype._generateSessionKey = function() {
        let key = sessionStorage.getItem('diana_session_key');
        if (!key) {
            key = 'brs_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('diana_session_key', key);
        }
        return key;
    };

    // Esporta globalmente
    window.Diana = DianaBrowser;

})(window);
