const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const USER_ID = '6e267f7e-827f-40b0-8a65-27a858ef081d';
const DATA_DIR = path.join('C:', 'Code', 'LifeOS2', '数据导入');

function genUuid(seed) {
    let hash = 0;
    const str = seed + Math.random().toString(36).substring(2, 10);
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    hash = Math.abs(hash);
    const hex = hash.toString(16).padStart(8, '0');
    const v4 = (hash % 16 & 0x3 | 0x8).toString(16);
    return `${hex.substring(0, 8)}-${hex.substring(0, 4)}-4${hex.substring(1, 4)}-${v4}${hex.substring(2, 4)}-${(hash * 2).toString(16).padStart(12, '0')}`.substring(0, 36);
}

function parseCSV(content) {
    const lines = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < content.length; i++) {
        const ch = content[i];
        if (ch === '"') {
            if (inQuotes && content[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === '\n' && !inQuotes) {
            lines.push(current);
            current = '';
        } else if (ch === '\r' && !inQuotes) {
            continue;
        } else {
            current += ch;
        }
    }
    if (current.trim()) lines.push(current);
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = parseCSVLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = (values[j] || '').trim();
        }
        rows.push(row);
    }
    return { headers, rows };
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    values.push(current);
    return values;
}

async function main() {
    console.log('Connecting to MySQL...');
    const conn = await mysql.createConnection({
        host: '127.0.0.1',
        port: 3307,
        user: 'root',
        password: '123456',
        database: 'lifeos',
        charset: 'utf8mb4',
    });

    await conn.execute('SET NAMES utf8mb4');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    // === 1. Medication Records ===
    console.log('Reading medication_records.csv...');
    const recordsContent = fs.readFileSync(path.join(DATA_DIR, 'medication_records_202605281357.csv'), 'utf-8');
    const recordsData = parseCSV(recordsContent);
    console.log(`Found ${recordsData.rows.length} medication records`);

    await conn.execute(`DELETE FROM health_medication_record WHERE user_id = ?`, [USER_ID]);
    for (const r of recordsData.rows) {
        const id = genUuid(`mr_${r.id}_${r.date}`);
        await conn.execute(
            `INSERT INTO health_medication_record (id, user_id, date, medicine_name, breakfast, lunch, dinner, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, USER_ID, r.date, r.medicine_name, r.breakfast || 0, r.lunch || 0, r.dinner || 0, r.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '), r.updated_at || r.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );
    }
    console.log(`✓ Inserted ${recordsData.rows.length} medication records`);

    // === 2. Purchase Records ===
    console.log('Reading medicine_purchase_records.csv...');
    const purchaseContent = fs.readFileSync(path.join(DATA_DIR, 'medicine_purchase_records_202605281357.csv'), 'utf-8');
    const purchaseData = parseCSV(purchaseContent);
    console.log(`Found ${purchaseData.rows.length} purchase records`);

    await conn.execute(`DELETE FROM health_medication_purchase WHERE user_id = ?`, [USER_ID]);
    for (const p of purchaseData.rows) {
        const id = genUuid(`mp_${p.id}_${p.purchase_date}`);
        await conn.execute(
            `INSERT INTO health_medication_purchase (id, user_id, purchase_date, medicine_name, quantity, unit, unit_price, total_price, channel, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, USER_ID, p.purchase_date, p.medicine_name, p.quantity || 0, p.unit || '', p.unit_price || 0, p.total_price || 0, p.channel || '', p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '), p.updated_at || p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );
    }
    console.log(`✓ Inserted ${purchaseData.rows.length} purchase records`);

    // === 3. Daily Summaries ===
    console.log('Reading medication_daily_summaries.csv...');
    const summaryContent = fs.readFileSync(path.join(DATA_DIR, 'medication_daily_summaries_202605281357.csv'), 'utf-8');
    const summaryData = parseCSV(summaryContent);
    console.log(`Found ${summaryData.rows.length} daily summaries`);

    await conn.execute(`DELETE FROM health_medication_summary WHERE user_id = ?`, [USER_ID]);
    for (const s of summaryData.rows) {
        const id = genUuid(`ms_${s.date}`);
        await conn.execute(
            `INSERT INTO health_medication_summary (id, user_id, date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, USER_ID, s.date, s.summary || '', s.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '), s.updated_at || s.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );
    }
    console.log(`✓ Inserted ${summaryData.rows.length} daily summaries`);

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Verify
    const [rows] = await conn.query(`
        SELECT 'medication_records' AS t, COUNT(*) AS c FROM health_medication_record WHERE user_id = ?
        UNION ALL SELECT 'medication_purchases', COUNT(*) FROM health_medication_purchase WHERE user_id = ?
        UNION ALL SELECT 'medication_summaries', COUNT(*) FROM health_medication_summary WHERE user_id = ?
    `, [USER_ID, USER_ID, USER_ID]);

    console.log('\n=== Migration Result ===');
    rows.forEach(r => console.log(`  ${r.t}: ${r.c} rows`));

    await conn.end();
    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
