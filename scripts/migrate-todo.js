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

function convertISO(isoStr) {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function main() {
    console.log('Connecting to MySQL...');
    const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '123456', database: 'lifeos', charset: 'utf8mb4' });
    await conn.execute('SET NAMES utf8mb4');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    console.log('\n=== Todo Tasks Migration ===');
    const csvContent = fs.readFileSync(path.join(DATA_DIR, 'todos_202605281728.csv'), 'utf-8');
    const { headers, rows } = parseCSV(csvContent);
    console.log(`Found ${rows.length} todo tasks`);

    await conn.execute(`DELETE FROM life_todo_task WHERE user_id = ?`, [USER_ID]);

    let completedCount = 0;
    let activeCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const id = genUuid(`todo_${r.id}`);
        const hasCompletedAt = !!r.completed_at && r.completed_at !== '';
        const trashedAt = r.deleted_at && r.deleted_at !== '' ? convertISO(r.deleted_at) : null;

        // Parse tags from CSV (empty string → empty array)
        let tagsJson = [];
        if (r.tags && r.tags.trim()) {
            try { tagsJson = JSON.parse(r.tags); } catch (e) { tagsJson = [r.tags]; }
        }

        // Determine is_daily: tasks with recurring_id are daily
        const isDaily = !!r.recurring_id && r.recurring_id !== '';

        await conn.execute(
            `INSERT INTO life_todo_task (id, user_id, title, description_markdown, due_date, priority, tags_json, is_daily, completed, completed_at, last_completed_date, trashed_at, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                id,
                USER_ID,
                r.title || '',
                r.description || '',
                r.due_date || null,
                r.priority || 'medium',
                JSON.stringify(tagsJson),
                isDaily ? 1 : 0,
                hasCompletedAt ? 1 : 0,
                hasCompletedAt ? convertISO(r.completed_at) : null,
                hasCompletedAt ? r.due_date : null,
                trashedAt,
                Number(r.sort_order) || 0
            ]
        );

        if (hasCompletedAt) completedCount++;
        else activeCount++;

        if ((i + 1) % 100 === 0 || i === rows.length - 1) {
            console.log(`  Progress: ${i + 1}/${rows.length}...`);
        }
    }

    // Settings
    console.log('\n=== Todo Settings ===');
    await conn.execute(
        `INSERT INTO life_todo_setting (user_id, reminder_enabled, reminder_time, lead_days, include_daily_tasks, include_overdue_tasks, last_auto_reminder_date)
         VALUES (?, 1, '09:00', 3, 1, 1, NULL)
         ON DUPLICATE KEY UPDATE
           reminder_enabled=VALUES(reminder_enabled),
           reminder_time=VALUES(reminder_time),
           lead_days=VALUES(lead_days),
           include_daily_tasks=VALUES(include_daily_tasks),
           include_overdue_tasks=VALUES(include_overdue_tasks),
           updated_at=NOW()`,
        [USER_ID]
    );
    console.log(`✓ Upserted todo settings`);

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Verify
    const [rows_result] = await conn.query(`
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) as completed_cnt,
               SUM(CASE WHEN completed=0 AND trashed_at IS NULL THEN 1 ELSE 0 END) as active_cnt,
               SUM(CASE WHEN trashed_at IS NOT NULL THEN 1 ELSE 0 END) as trashed_cnt
        FROM life_todo_task WHERE user_id = ?
    `, [USER_ID]);

    const [dates] = await conn.query(`
        MIN(due_date) as min_d, MAX(due_date) as max_d
        FROM life_todo_task WHERE user_id = ? AND due_date IS NOT NULL
    `, [USER_ID]);

    const s = rows_result[0];

    console.log('\n=== Migration Result ===');
    console.log(`  Total: ${s.total} tasks`);
    console.log(`  Completed: ${s.completed_cnt}`);
    console.log(`  Active: ${s.active_cnt}`);
    console.log(`  Trashed: ${s.trashed_cnt}`);
    if (dates[0].min_d) console.log(`  Date range: ${dates[0].min_d} ~ ${dates[0].max_d}`);

    await conn.end();
    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
