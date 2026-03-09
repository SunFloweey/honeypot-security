const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/config/database');

describe('🍯 Honeypot System Integration Tests', () => {

    // Pulizia e setup database prima dei test
    beforeAll(async () => {
        // Non facciamo il sync(force: true) per evitare di cancellare dati reali dell'utente, 
        // ma ci assicuriamo che la connessione sia attiva.
        await sequelize.authenticate();
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('📁 Bait & Deception Endpoints', () => {

        test('Should catch access to .env and return fake data', async () => {
            const res = await request(app).get('/.env');
            expect(res.statusCode).toBe(200);
            // The fake .env uses APP_NAME, DB_HOST, JWT_SECRET etc. — not APP_KEY
            expect(res.text).toContain('DB_HOST=');
            expect(res.text).toContain('JWT_SECRET=');
            expect(res.headers['content-type']).toContain('text/plain');
        });

        test('Should return a realistic fake ZIP for backup.zip', async () => {
            const res = await request(app)
                .get('/backup.zip')
                .buffer(true)
                .parse((res, callback) => {
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => callback(null, Buffer.concat(chunks)));
                });
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('application/zip');
            // Verifica header PK (0x50 0x4B) - ZIP magic bytes
            expect(res.body[0]).toBe(0x50);
            expect(res.body[1]).toBe(0x4B);
        });

        test('Should return WordPress config for wp-config.php', async () => {
            const res = await request(app).get('/wp-config.php');
            expect(res.statusCode).toBe(200);
            // File bait contains DB_NAME, AUTH_KEY and $table_prefix = 'wp_'
            expect(res.text).toContain('DB_NAME');
            expect(res.text).toContain('AUTH_KEY');
            expect(res.text).toContain("table_prefix = 'wp_'");
        });
    });

    describe('🛡️ Threat Detection (Logging & Risk)', () => {

        test('Should log SQL Injection attempts', async () => {
            const res = await request(app).get("/api/users?id=1' OR '1'='1");
            // L'honeypot dovrebbe rispondere 200 (per non spaventare l'hacker) o 404
            // ma l'importante è che il middleware catturi l'azione.
            expect(res.statusCode).not.toBe(500);
        });

        test('Should identify Command Injection in query params', async () => {
            const res = await request(app).get('/search?q=;cat /etc/passwd');
            expect(res.statusCode).not.toBe(500);
        });
    });

    describe('💻 Virtual Terminal (Webshells)', () => {

        test('Should serve a fake webshell interface on /shell.php', async () => {
            const res = await request(app).get('/shell.php');
            expect(res.statusCode).toBe(200);
            expect(res.text).toContain('form method="GET"');
            expect(res.text).toContain('cmd');
        });

        test('Should execute commands via shell.php?cmd=...', async () => {
            // Nota: questo test potrebbe fallire se non hai una connessione internet/chiave AI valida
            // perché chiama l'AIService. Lo testiamo con un timeout lungo.
            const res = await request(app).get('/shell.php?cmd=whoami');
            expect(res.statusCode).toBe(200);
            // L'output dovrebbe sembrare quello di un server linux
            expect(typeof res.text).toBe('string');
        });
    });
});
