const { User, ApiKey } = require('./src/models');
const { sequelize } = require('./src/config/database');

async function createCustomer() {
    try {
        await sequelize.authenticate();
        
        // 1. Crea l'utente cliente
        const [user, created] = await User.findOrCreate({
            where: { email: 'cliente@test.it' },
            defaults: {
                name: 'Mario Rossi',
                password: 'password123', // Verrà hashata dall'hook del modello
                role: 'user',
                isActive: true
            }
        });

        if (!created) {
            console.log('ℹ️ Utente già esistente.');
        } else {
            console.log('✅ Utente "cliente@test.it" creato con successo.');
        }

        // 2. Genera una API Key per il suo primo progetto
        const apiKey = await ApiKey.create({
            userId: user.id,
            name: 'E-commerce Shop',
            key: `hp_sk_${require('crypto').randomBytes(16).toString('hex')}`
        });

        console.log('\n--- CREDENZIALI PER IL CLIENTE ---');
        console.log(`Email: ${user.email}`);
        console.log(`Password: password123`);
        console.log(`API Key: ${apiKey.key}`);
        console.log(`Project Name: ${apiKey.name}`);
        console.log('----------------------------------\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore:', error);
        process.exit(1);
    }
}

createCustomer();
