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

function parseTimeRange(tr) {
    if (!tr || tr === '??') return { start: '00:00', end: '00:01' };
    const m = tr.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (m) return { start: m[1], end: m[2] };
    return { start: '00:00', end: '00:01' };
}

function calcDuration(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let d = eh * 60 + em - (sh * 60 + sm);
    if (d < 0) d += 24 * 60;
    return d;
}

async function main() {
    console.log('Connecting to MySQL...');
    const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '123456', database: 'lifeos', charset: 'utf8mb4' });
    await conn.execute('SET NAMES utf8mb4');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Build book ID map: old CSV id -> new UUID
    const booksCsv = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'travel_books_202605281633.csv'), 'utf-8'));
    const bookIdMap = new Map();
    for (const r of booksCsv.rows) {
        bookIdMap.set(r.id, genUuid(`travel_book_${r.id}`));
    }

    // === 1. Travel Books ===
    console.log('\n=== 1. Travel Books ===');
    console.log(`Found ${booksCsv.rows.length} travel books`);
    await conn.execute(`DELETE FROM finance_travel_book WHERE user_id = ?`, [USER_ID]);
    let bookCount = 0;
    for (const r of booksCsv.rows) {
        const id = bookIdMap.get(r.id);
        const name = r.name || '';
        const startDate = r.start_date || extractDateFromName(name) || r.created_at || null;
        await conn.execute(
            `INSERT INTO finance_travel_book (id, user_id, name, description, start_date, end_date, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [id, USER_ID, name, r.description || '', startDate || null, r.end_date || null, r.summary || '']
        );
        bookCount++;
    }
    console.log(`✓ Inserted ${bookCount} travel books`);

    // === 2. Pay Channels ===
    console.log('\n=== 2. Pay Channels ===');
    const pcCsv = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'payment_channels_202605281633.csv'), 'utf-8'));
    console.log(`Found ${pcCsv.rows.length} payment channels`);
    await conn.execute(`DELETE FROM finance_travel_pay_channel WHERE 1=1`);
    let pcCount = 0;
    for (const r of pcCsv.rows) {
        const id = genUuid(`travel_pc_${r.id}`);
        await conn.execute(
            `INSERT INTO finance_travel_pay_channel (id, value, label, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
            [id, r.value || '', r.label || '']
        );
        pcCount++;
        console.log(`  [${pcCount}] ${r.value} / ${r.label}`);
    }
    console.log(`✓ Inserted ${pcCount} pay channels`);

    // === 3. Expense Records ===
    console.log('\n=== 3. Expense Records ===');
    const expCsv = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'expense_items_202605281633.csv'), 'utf-8'));
    console.log(`Found ${expCsv.rows.length} expense records`);
    await conn.execute(`DELETE FROM finance_travel_expense_record WHERE user_id = ?`, [USER_ID]);
    let expCount = 0;
    for (const r of expCsv.rows) {
        const id = genUuid(`travel_exp_${r.id}_${r.date}`);
        const bookId = bookIdMap.get(r.book_id) || '';
        const { start: timeStart, end: timeEnd } = parseTimeRange(r.time_range);
        const dur = r.duration_minutes ? parseInt(r.duration_minutes, 10) || 0 : calcDuration(timeStart, timeEnd);

        await conn.execute(
            `INSERT INTO finance_travel_expense_record (id, user_id, book_id, date, time_start, time_end, duration_minutes, category, title, amount, discount_amount, discount_note, vehicle_info, pay_channel, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                id, USER_ID, bookId,
                r.date || '',
                timeStart, timeEnd,
                dur,
                r.category || '',
                r.title || '',
                Number(r.amount) || 0,
                Number(r.discount_amount) || 0,
                r.discount_note || '',
                r.vehicle_no || '',
                r.pay_channel || '',
                r.remark || ''
            ]
        );
        expCount++;
    }
    console.log(`✓ Inserted ${expCount} expense records`);

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Verify
    const [rows] = await conn.query(`
        SELECT 'books' AS t, COUNT(*) AS c FROM finance_travel_book WHERE user_id = ?
        UNION ALL SELECT 'expenses', COUNT(*) FROM finance_travel_expense_record WHERE user_id = ?
        UNION ALL SELECT 'channels', COUNT(*) FROM finance_travel_pay_channel
    `, [USER_ID, USER_ID]);

    console.log('\n=== Migration Result ===');
    rows.forEach(r => console.log(`  ${r.t}: ${r.c}`));

    const [dates] = await conn.query(`
        SELECT MIN(date) as min_d, MAX(date) as max_d,
               SUM(amount) as total_amt
        FROM finance_travel_expense_record WHERE user_id = ?
    `, [USER_ID]);
    console.log(`Expense date range: ${dates[0].min_d} ~ ${dates[0].max_d}`);
    console.log(`Total expense amount: ¥${Number(dates[0].total_amt).toFixed(2)}`);

    await conn.end();
    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
