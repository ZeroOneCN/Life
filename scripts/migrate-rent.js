const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const USER_ID = '6e267f7e-827f-40b0-8a65-27a858ef081d';
const DATA_DIR = path.join('C:', 'Code', 'LifeOS2', '数据导入');

function genUuid(seed) {
    let hash = 0;
    const str = seed + Math.random().toString(36).substring(2, 10);
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0; }
    hash = Math.abs(hash);
    const hex = hash.toString(16).padStart(8, '0');
    const v4 = (hash % 16 & 0x3 | 0x8).toString(16);
    return `${hex.substring(0, 8)}-${hex.substring(0, 4)}-4${hex.substring(1, 4)}-${v4}${hex.substring(2, 4)}-${(hash * 2).toString(16).padStart(12, '0')}`.substring(0, 36);
}

function parseCSV(content) {
    const lines = []; let current = ''; let inQ = false;
    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (ch === '"') { if (inQ && content[i + 1] === '"') { current += '"'; i++; } else { inQ = !inQ; } }
        else if (ch === '\n' && !inQ) { lines.push(current); current = ''; }
        else if (ch === '\r' && !inQ) { continue; }
        else { current += ch; }
    }
    if (current.trim()) lines.push(current);
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = parseCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        let vals = parseCSVLine(lines[i]);
        if (vals.length > headers.length) {
            const extra = vals.splice(1, vals.length - headers.length);
            vals[1] = extra.join(',') + (vals[1] ? ',' + vals[1] : '');
        }
        const row = {};
        for (let j = 0; j < headers.length; j++) row[headers[j]] = (vals[j] || '').trim();
        rows.push(row);
    }
    return { headers, rows };
}
function parseCSVLine(line) {
    const vals = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
        else if (ch === ',' && !inQ) { vals.push(cur); cur = ''; } else { cur += ch; }
    }
    vals.push(cur); return vals;
}

async function main() {
    console.log('Connecting to MySQL...');
    const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '123456', database: 'lifeos', charset: 'utf8mb4' });
    await conn.execute('SET NAMES utf8mb4');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    // === 1. Channels ===
    console.log('\n=== 1. Rent Channels ===');
    const chCsv = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'housing_channels_202605281707.csv'), 'utf-8'));
    console.log(`Found ${chCsv.rows.length} channels`);
    const chIdMap = new Map();
    await conn.execute(`DELETE FROM finance_rent_channel WHERE user_id = ?`, [USER_ID]);
    let chCount = 0;
    for (const r of chCsv.rows) {
        const id = genUuid(`rent_ch_${r.id}`);
        chIdMap.set(r.id, id);
        await conn.execute(
            `INSERT INTO finance_rent_channel (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
            [id, USER_ID, r.name || '']
        );
        chCount++;
        console.log(`  [${chCount}] ${r.name}`);
    }
    console.log(`✓ Inserted ${chCount} channels`);

    // Build name map for records
    const chNameMap = new Map();
    for (const r of chCsv.rows) chNameMap.set(r.id, r.name || '');

    // === 2. Records ===
    console.log('\n=== 2. Rent Records ===');
    const recCsv = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'housing_records_202605281707.csv'), 'utf-8'));
    console.log(`Found ${recCsv.rows.length} records`);
    await conn.execute(`DELETE FROM finance_rent_record WHERE user_id = ?`, [USER_ID]);
    let recCount = 0;
    for (const r of recCsv.rows) {
        const id = genUuid(`rent_rec_${r.id}`);
        const channelId = chIdMap.get(r.housing_channel_id) || '';
        const channelName = chNameMap.get(r.housing_channel_id) || '';

        await conn.execute(
            `INSERT INTO finance_rent_record (id, user_id, address, channel_id, channel_name, move_in_date, move_out_date, rent, deposit, electricity_fee, water_fee, gas_fee, agency_fee, cleaning_fee, laundry_fee, service_fee, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                id, USER_ID,
                r.address || '',
                channelId,
                channelName,
                r.move_in_date || '',
                r.move_out_date || null,
                Number(r.rent) || 0,
                Number(r.deposit) || 0,
                Number(r.electricity_fee) || 0,
                Number(r.water_fee) || 0,
                Number(r.gas_fee) || 0,
                Number(r.agency_fee) || 0,
                Number(r.cleaning_fee) || 0,
                Number(r.laundry_fee) || 0,
                Number(r.service_fee) || 0,
                r.notes || ''
            ]
        );
        recCount++;
        console.log(`  [${recCount}] ${r.address.substring(0, 30)}... | ¥${r.rent}/月`);
    }
    console.log(`✓ Inserted ${recCount} records`);

    // === 3. Settings ===
    console.log('\n=== 3. Rent Settings ===');
    await conn.execute(
        `INSERT INTO finance_rent_setting (user_id, active_user_id, records_user_id, statistics_user_id, editing_record_id)
         VALUES (?, ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE
           active_user_id=VALUES(active_user_id),
           records_user_id=VALUES(records_user_id),
           statistics_user_id=VALUES(statistics_user_id),
           updated_at=NOW()`,
        [USER_ID, USER_ID, USER_ID, USER_ID]
    );
    console.log(`✓ Upserted rent settings`);

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Verify
    const [rows] = await conn.query(`
        SELECT 'channels' AS t, COUNT(*) AS c FROM finance_rent_channel WHERE user_id = ?
        UNION ALL SELECT 'records', COUNT(*) FROM finance_rent_record WHERE user_id = ?
        UNION ALL SELECT 'settings', COUNT(*) FROM finance_rent_setting WHERE user_id = ?
    `, [USER_ID, USER_ID, USER_ID]);

    console.log('\n=== Migration Result ===');
    rows.forEach(r => console.log(`  ${r.t}: ${r.c}`));

    const [stats] = await conn.query(`
        SELECT SUM(rent) as total_rent, SUM(deposit) as total_deposit,
               SUM(electricity_fee+water_fee+gas_fee+agency_fee+cleaning_fee+laundry_fee+service_fee) as total_fees,
               SUM(rent+electricity_fee+water_fee+gas_fee+agency_fee+cleaning_fee+laundry_fee+service_fee) as total_cost,
               COUNT(CASE WHEN move_out_date IS NULL THEN 1 END) as active_count,
               COUNT(CASE WHEN move_out_date IS NOT NULL THEN 1 END) as ended_count
        FROM finance_rent_record WHERE user_id = ?
    `, [USER_ID]);
    const s = stats[0];
    console.log(`\nTotal rent: ¥${Number(s.total_rent).toFixed(2)} | Deposit: ¥${Number(s.total_deposit).toFixed(2)}`);
    console.log(`Total fees: ¥${Number(s.total_fees).toFixed(2)} | Total cost: ¥${Number(s.total_cost).toFixed(2)}`);
    console.log(`Records: ${s.active_count} active + ${s.ended_count} ended = ${Number(s.active_count)+Number(s.ended_count)} total`);

    await conn.end();
    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
