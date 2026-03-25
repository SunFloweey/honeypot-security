const axios = require('axios');
async function lanciaAttacchi() {
    console.log('--- AVVIO SIMULAZIONE SCUDO ---');
    try {
        console.log('1. Navigo sulla bait shell: /wp-admin?cmd=whoami');
        const r1 = await axios.get('http://localhost:5000/wp-admin?cmd=whoami');
        console.log('RISPOSTA FINTA DALLO SCUDO:', r1.data.substring(0, 50) + '...');
    } catch(e) { console.log('ERRORE 1', e.message); }

    try {
        console.log('\n2. Cerco di leggere un file sensibile esca: /.env');
        await axios.get('http://localhost:5000/.env');
    } catch(e) { console.log('RISPOSTA DEL CANARY:', e.response?.status, '->', e.response?.data); }

    try {
        console.log('\n3. Attacco SQL Injection mascherato: ?id=UNION SELECT');
        await axios.get('http://localhost:5000/prodotti?id=UNION%20SELECT');
        console.log('Purtroppo essendo solo monitor, la richiesta procede se custom non blocca. Ma l\'evento scatta in background!');
    } catch(e) { console.log('ERRORE 3', e.message); }
}
lanciaAttacchi();
