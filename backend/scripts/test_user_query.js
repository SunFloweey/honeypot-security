const { sequelize } = require('../src/config/database');

async function testQuery() {
    try {
        const [results] = await sequelize.query(`
            SELECT l.id, l.path, k.name as project_name, u.email as owner 
            FROM logs l 
            JOIN api_keys k ON l.api_key_id = k.id 
            JOIN users u ON k.user_id = u.id 
            WHERE u.email = 'streetcats@mail.com' 
            LIMIT 5
        `);
        console.log('Query Results:', results);
    } catch (err) {
        console.error('Query Error:', err.message);
    }
}

testQuery().then(() => process.exit());
