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
    if (lines.length < 2) return { rows: [] };
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
    return { rows };
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

function parseYYMMDD(s) {
    const m = String(s).match(/^(\d{2})(\d{2})(\d{2})$/);
    if (!m) return s;
    const y = parseInt(m[1], 10);
    return `20${y}-${m[2]}-${m[3]}`;
}

async function main() {
    console.log('Connecting to MySQL...');
    const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '123456', database: 'lifeos', charset: 'utf8mb4' });
    await conn.execute('SET NAMES utf8mb4');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    // === 1. Create Default Ledger ===
    console.log('\n=== 1. Create Default Ledger ===');
    const [existingLedgers] = await conn.query('SELECT id FROM finance_shopping_ledger LIMIT 1');
    let defaultLedgerId;
    if (existingLedgers.length > 0) {
        defaultLedgerId = existingLedgers[0].id;
        console.log(`Using existing ledger: ${defaultLedgerId}`);
    } else {
        defaultLedgerId = genUuid('default-ledger');
        await conn.execute(
            `INSERT INTO finance_shopping_ledger (id, name, description, start_date, end_date, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, 1, NOW(), NOW())`,
            [defaultLedgerId, '默认账本', '从旧系统迁移的购物记录', '2025-01-01']
        );
        console.log(`Created default ledger: ${defaultLedgerId}`);
    }

    // === 2. Shopping Records ===
    console.log('\n=== 2. Shopping Records ===');
    console.log('Reading shopping_records.csv...');
    const csvContent = fs.readFileSync(path.join(DATA_DIR, 'shopping_records_202605281548.csv'), 'utf-8');
    const data = parseCSV(csvContent);
    console.log(`Found ${data.rows.length} shopping records`);

    await conn.execute(`DELETE FROM finance_shopping_record WHERE user_id = ?`, [USER_ID]);

    // Build platform set to create later
    const platformSet = new Map();
    let recCount = 0;
    for (const r of data.rows) {
        const id = genUuid(`shop_${r.id}_${r.date}_${r.order_no}`);
        const dateStr = parseYYMMDD(r.date);
        const platform = r.platform || '';
        if (platform) platformSet.set(platform, (platformSet.get(platform) || 0) + 1);

        await conn.execute(
            `INSERT INTO finance_shopping_record (id, user_id, ledger_id, date, platform, item_name, spec, price, unit_price, order_no, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [id, USER_ID, defaultLedgerId, dateStr, platform, r.name || '', r.spec || '', Number(r.price) || 0, r.unit_price ? Number(r.unit_price) : null, r.order_no || '', r.note || '']
        );
        recCount++;
    }
    console.log(`✓ Inserted ${recCount} shopping records`);

    // === 3. Ensure Platforms Exist ===
    console.log('\n=== 3. Platforms ===');
    for (const [name, count] of platformSet) {
        const [existing] = await conn.query('SELECT id FROM finance_shopping_platform WHERE name = ?', [name]);
        if (existing.length > 0) {
            console.log(`  Platform "${name}" already exists (${count} records)`);
        } else {
            const platId = genUuid(`plat_${name}`);
            await conn.execute(
                `INSERT INTO finance_shopping_platform (id, name, color_token, is_built_in, created_at, updated_at) VALUES (?, ?, '', 0, NOW(), NOW())`,
                [platId, name]
            );
            console.log(`  Created platform "${name}" (${count} records)`);
        }
    }

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Verify
    const [rows] = await conn.query(`
        SELECT 'shopping_records' AS t, COUNT(*) AS c FROM finance_shopping_record WHERE user_id = ?
        UNION ALL SELECT 'ledgers', COUNT(*) FROM finance_shopping_ledger
        UNION ALL SELECT 'platforms', COUNT(*) FROM finance_shopping_platform
    `, [USER_ID]);

    console.log('\n=== Migration Result ===');
    rows.forEach(r => console.log(`  ${r.t}: ${r.c}`));

    // Date range check
    const [dates] = await conn.query('SELECT MIN(date) as min_d, MAX(date) as max_d FROM finance_shopping_record WHERE user_id = ?', [USER_ID]);
    console.log(`\nDate range: ${dates[0].min_d} ~ ${dates[0].max_d}`);

    await conn.end();
    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
