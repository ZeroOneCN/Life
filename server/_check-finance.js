const mysql = require('mysql2/promise');
(async () => {
    const c = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '123456', database: 'lifeos' });
    const [ledgers] = await c.query('SELECT id,name,is_active FROM finance_shopping_ledger');
    console.log('=== Existing Ledgers ==='); ledgers.forEach(l => console.log(JSON.stringify(l)));
    const [platforms] = await c.query('SELECT id,name FROM finance_shopping_platform');
    console.log('\n=== Platforms ==='); platforms.forEach(p => console.log(JSON.stringify(p)));
    const [recCnt] = await c.query('SELECT COUNT(*) as cnt FROM finance_shopping_record');
    console.log('\nExisting records:', recCnt[0].cnt);
    await c.end();
})();
