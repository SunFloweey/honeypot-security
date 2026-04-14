const { User } = require('./backend/src/models');

async function listUsers() {
    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'password', 'role']

        });
        console.log('--- Utenti nel Database ---');
        users.forEach(u => {
            console.log(`ID: ${u.id} | User: ${u.username} | Email: ${u.email}`);
            console.log(`Password Hash: ${u.password}\n`);

        });

    } catch (e) {
        console.error('Errore:', e.message);

    }
    process.exit();

}
listUsers();