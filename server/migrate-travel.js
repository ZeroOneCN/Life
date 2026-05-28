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

function extractDateFromName(name) {
    const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}

async function main() {
    console.log('Connecting to MySQL...');
    const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '123456', database: 'lifeos', charset: 'utf8mb4' });
    await conn.execute('SET NAMES utf8mb4');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    console.log('\n=== Travel Books Migration ===');
    const csvContent = fs.readFileSync(path.join(DATA_DIR, 'travel_books_202605281633.csv'), 'utf-8');
    const { headers, rows } = parseCSV(csvContent);
    console.log(`Found ${rows.length} travel books`);

    await conn.execute(`DELETE FROM finance_travel_book WHERE user_id = ?`, [USER_ID]);

    let count = 0;
    for (const r of rows) {
        const id = genUuid(`travel_book_${r.id}`);
        const name = r.name || '';
        const startDate = r.start_date || extractDateFromName(name) || r.created_at || null;
        const endDate = r.end_date || null;

        await conn.execute(
            `INSERT INTO finance_travel_book (id, user_id, name, description, start_date, end_date, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [id, USER_ID, name, r.description || '', startDate || null, endDate, r.summary || '']
        );
        count++;
        console.log(`  [${count}] ${name} | date=${startDate || '(empty)'}`);
    }

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    const [result] = await conn.query('SELECT COUNT(*) AS c FROM finance_travel_book WHERE user_id = ?', [USER_ID]);
    console.log(`\n✓ Migrated ${result[0].c} travel books`);

    const [dates] = await conn.query('SELECT MIN(start_date) as min_d, MAX(start_date) as max_d FROM finance_travel_book WHERE user_id = ? AND start_date IS NOT NULL', [USER_ID]);
    if (dates[0].min_d) {
        console.log(`Date range: ${dates[0].min_d} ~ ${dates[0].max_d}`);
    }

    await conn.end();
    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
