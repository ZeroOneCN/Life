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

    // === 1. Platforms ===
    console.log('\n=== 1. Loan Platforms ===');
    const platCsv = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'debt_platforms_202605281650.csv'), 'utf-8'));
    console.log(`Found ${platCsv.rows.length} platforms`);
    const platIdMap = new Map();
    await conn.execute(`DELETE FROM finance_loan_platform WHERE user_id = ?`, [USER_ID]);
    let platCount = 0;
    for (const r of platCsv.rows) {
        const id = genUuid(`loan_plat_${r.id}`);
        platIdMap.set(r.id, id);
        await conn.execute(
            `INSERT INTO finance_loan_platform (id, user_id, name, billing_day, repayment_day, credit_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [id, USER_ID, r.name || '', Number(r.billing_day) || 1, Number(r.repayment_day) || 1, Number(r.credit_limit) || 0]
        );
        platCount++;
        console.log(`  [${platCount}] ${r.name} (billing=${r.billing_day}, repayment=${r.repayment_day}, limit=${r.credit_limit})`);
    }
    console.log(`✓ Inserted ${platCount} platforms`);

    // Get platform names map for bills
    const platNameMap = new Map();
    for (const r of platCsv.rows) platNameMap.set(r.id, r.name || '');

    // === 2. Bills ===
    console.log('\n=== 2. Loan Bills ===');
    const billCsv = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'bills_202605281650.csv'), 'utf-8'));
    console.log(`Found ${billCsv.rows.length} bills`);
    const billIdMap = new Map();
    await conn.execute(`DELETE FROM finance_loan_bill WHERE user_id = ?`, [USER_ID]);
    let billCount = 0;
    for (const r of billCsv.rows) {
        const id = genUuid(`loan_bill_${r.id}`);
        billIdMap.set(r.id, id);
        const platformId = platIdMap.get(r.platform_id) || '';
        const platformName = platNameMap.get(r.platform_id) || '';
        const isPaid = Number(r.is_paid) === 1;

        await conn.execute(
            `INSERT INTO finance_loan_bill (id, user_id, platform_id, platform_name, amount, interest, billing_month, due_date, notes, is_paid, paid_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                id, USER_ID,
                platformId, platformName,
                Number(r.amount) || 0,
                Number(r.interest) || 0,
                r.billing_month || '',
                r.due_date || null,
                r.notes || '',
                isPaid,
                isPaid ? (r.paid_date || null) : null
            ]
        );
        billCount++;
    }
    console.log(`✓ Inserted ${billCount} bills`);

    // === 3. Repayments ===
    console.log('\n=== 3. Loan Repayments ===');
    const repCsv = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'repayment_records_202605281650.csv'), 'utf-8'));
    console.log(`Found ${repCsv.rows.length} repayment records`);
    await conn.execute(`DELETE FROM finance_loan_repayment WHERE user_id = ?`, [USER_ID]);
    let repCount = 0;
    for (const r of repCsv.rows) {
        const id = genUuid(`loan_rep_${r.id}_${r.bill_id}`);
        const billId = billIdMap.get(r.bill_id) || null;
        const platformId = platIdMap.get(
            billCsv.rows.find(b => b.id === r.bill_id)?.platform_id
        ) || '';

        // Find platform name from original bill's platform
        const billRow = billCsv.rows.find(b => b.id === r.bill_id);
        const platformName = billRow ? (platNameMap.get(billRow.platform_id) || '') : '';

        await conn.execute(
            `INSERT INTO finance_loan_repayment (id, user_id, bill_id, platform_id, platform_name, amount, interest, repayment_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                id, USER_ID,
                billId,
                platformId,
                platformName,
                Number(r.amount) || 0,
                Number(r.interest) || 0,
                r.repayment_date || '',
                r.notes || ''
            ]
        );
        repCount++;
    }
    console.log(`✓ Inserted ${repCount} repayments`);

    // === 4. Settings (upsert) ===
    console.log('\n=== 4. Loan Settings ===');
    const settingsCsv = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'system_settings_202605281650.csv'), 'utf-8'));
    const settingMap = {};
    for (const r of settingsCsv.rows) {
        settingMap[r.key] = r.value;
    }

    const upcomingDays = parseInt(settingMap.upcomingDays || '7', 10) || 7;
    const notificationFreq = settingMap.notificationFrequency || 'daily';
    const autoRepay = String(settingMap.autoRepaymentOnMarkPaid || 'true').toLowerCase() === 'true' ? 1 : 0;
    const repayRemind = String(settingMap.overdueEnabled || 'true').toLowerCase() === 'true' ? 1 : 1;
    const overdueRemind = String(settingMap.overdueEnabled || 'true').toLowerCase() === 'true' ? 1 : 1;

    await conn.execute(
        `INSERT INTO finance_loan_setting (user_id, repayment_reminder_enabled, overdue_reminder_enabled, auto_repayment_on_mark_paid, notification_frequency, upcoming_days, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           repayment_reminder_enabled=VALUES(repayment_reminder_enabled),
           overdue_reminder_enabled=VALUES(overdue_reminder_enabled),
           auto_repayment_on_mark_paid=VALUES(auto_repayment_on_mark_paid),
           notification_frequency=VALUES(notification_frequency),
           upcoming_days=VALUES(upcoming_days),
           updated_at=NOW()`,
        [USER_ID, repayRemind, overdueRemind, autoRepay, notificationFreq, upcomingDays]
    );
    console.log(`✓ Upserted loan settings (upcomingDays=${upcomingDays}, freq=${notificationFreq})`);

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Verify
    const [rows] = await conn.query(`
        SELECT 'platforms' AS t, COUNT(*) AS c FROM finance_loan_platform WHERE user_id = ?
        UNION ALL SELECT 'bills', COUNT(*) FROM finance_loan_bill WHERE user_id = ?
        UNION ALL SELECT 'repayments', COUNT(*) FROM finance_loan_repayment WHERE user_id = ?
        UNION ALL SELECT 'settings', COUNT(*) FROM finance_loan_setting WHERE user_id = ?
    `, [USER_ID, USER_ID, USER_ID, USER_ID]);

    console.log('\n=== Migration Result ===');
    rows.forEach(r => console.log(`  ${r.t}: ${r.c}`));

    const [stats] = await conn.query(`
        SELECT SUM(amount) as total_debt, SUM(interest) as total_interest,
               COUNT(CASE WHEN is_paid=1 THEN 1 END) as paid_count,
               COUNT(CASE WHEN is_paid=0 THEN 1 END) as unpaid_count
        FROM finance_loan_bill WHERE user_id = ?
    `, [USER_ID]);
    const s = stats[0];
    console.log(`\nTotal debt: ¥${Number(s.total_debt).toFixed(2)} | Interest: ¥${Number(s.total_interest).toFixed(2)}`);
    console.log(`Bills: ${s.paid_count} paid + ${s.unpaid_count} unpaid = ${Number(s.paid_count) + Number(s.unpaid_count)} total`);

    const [dates] = await conn.query(`
        SELECT MIN(billing_month) as min_m, MAX(billing_month) as max_m FROM finance_loan_bill WHERE user_id = ?
    `, [USER_ID]);
    console.log(`Billing month range: ${dates[0].min_m} ~ ${dates[0].max_m}`);

    await conn.end();
    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
