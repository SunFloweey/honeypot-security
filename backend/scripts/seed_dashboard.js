const { User, ApiKey } = require('../src/models');
const { sequelize } = require('../src/config/database');

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connessione al database riuscita.');

        // 1. Crea Utente Admin
        const [user, created] = await User.findOrCreate({
            where: { email: 'admin@honeypot.com' },
            defaults: {
                name: 'Administrator',
                password: 'password123',
                role: 'admin',
                is_active: true
            }
        });

        if (created) {
            console.log('👤 Utente Amministratore creato: admin@honeypot.com / password123');
        } else {
            console.log('ℹ️ Utente Amministratore già esistente.');
        }

        // 2. Crea Chiave API per il progetto 'streetcats'
        const [apiKey, keyCreated] = await ApiKey.findOrCreate({
            where: { name: 'streetcats' },
            defaults: {
                userId: user.id,
                key: 'hp_sk_streetcats_test_key_123',
                isActive: true
            }
        });

        if (keyCreated) {
            console.log(`🔑 Chiave API creata per 'streetcats': ${apiKey.key}`);
        } else {
            console.log('ℹ️ Chiave API per streetcats già esistente.');
        }

        console.log('\n🚀 Database popolato! Ora dovresti vedere i dati nella Dashboard.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore durante il seeding:', error);
        process.exit(1);
    }
}

seed();
