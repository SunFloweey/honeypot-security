require('dotenv').config({ path: './backend/.env' });
const { User } = require('../backend/src/models');

async function listUsers() {
    console.log('🔍 Ricerca utenti nel database in corso...\n');
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'password', 'role']
        });

        if (users.length === 0) {
            console.log('⚠️ Nessun utente trovato nel database.');
        } else {
            console.log(`✅ Trovati ${users.length} utenti:\n`);
            users.forEach(u => {
                console.log(`-----------------------------------------`);
                console.log(`🆔 ID:       ${u.id}`);
                console.log(`👤 Username: ${u.username}`);
                console.log(`📧 Email:    ${u.email}`);
                console.log(`🔑 Role:     ${u.role}`);
                console.log(`🔒 Password (Hash): ${u.password}`);
            });
            console.log(`-----------------------------------------`);
        }
    } catch (e) {
        console.error('❌ Errore durante il recupero degli utenti:', e.message);
        console.log('\nSuggerimento: Assicurati che il database PostgreSQL sia attivo e che le credenziali nel file backend/.env siano corrette.');
    } finally {
        process.exit();
    }
}

listUsers();
