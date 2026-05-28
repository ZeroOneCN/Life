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
            if (inQuotes && content[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (ch === '\n' && !inQuotes) { lines.push(current); current = ''; }
        else if (ch === '\r' && !inQuotes) { continue; }
        else { current += ch; }
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
    const values = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
        else if (ch === ',' && !inQuotes) { values.push(current); current = ''; }
        else { current += ch; }
    }
    values.push(current);
    return values;
}

function esc(s) { return String(s || '').replace(/'/g, "''"); }

async function main() {
    console.log('Connecting to MySQL...');
    const conn = await mysql.createConnection({
        host: '127.0.0.1', port: 3307, user: 'root', password: '123456',
        database: 'lifeos', charset: 'utf8mb4',
    });
    await conn.execute('SET NAMES utf8mb4');
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

    // === 1. Checkup Records (from biochemical_tests) ===
    console.log('\n=== 1. Checkup Records ===');
    console.log('Reading biochemical_tests.csv...');
    const testsContent = fs.readFileSync(path.join(DATA_DIR, 'biochemical_tests_202605281520.csv'), 'utf-8');
    const testsData = parseCSV(testsContent);
    console.log(`Found ${testsData.rows.length} test records`);

    await conn.execute(`DELETE FROM health_checkup_record WHERE user_id = ?`, [USER_ID]);
    let recCount = 0;
    for (const r of testsData.rows) {
        const id = genUuid(`cr_${r.id}_${r.test_date}_${r.test_name}`);
        const status = r.is_normal === '1' ? 'normal' : r.is_normal === '0' ? 'abnormal' : 'unknown';
        const notes = r.notes && r.notes !== 'null' ? r.notes : '';
        await conn.execute(
            `INSERT INTO health_checkup_record (id, user_id, test_date, test_type, test_name, value, unit, reference_range, notes, follow_up_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
            [id, USER_ID, r.test_date, r.test_type, r.test_name, r.test_value || 0, r.test_unit || '', r.reference_range || '', notes, status, r.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '), r.updated_at || r.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')]
        );
        recCount++;
    }
    console.log(`✓ Inserted ${recCount} checkup records`);

    // === 2. Templates (from biochemical_templates) ===
    console.log('\n=== 2. Checkup Templates ===');
    console.log('Reading biochemical_templates.csv...');
    const tplContent = fs.readFileSync(path.join(DATA_DIR, 'biochemical_templates_202605281520.csv'), 'utf-8');
    const tplData = parseCSV(tplContent);
    console.log(`Found ${tplData.rows.length} templates`);

    await conn.execute(`DELETE FROM health_checkup_template_item WHERE template_id IN (SELECT id FROM health_checkup_template WHERE user_id = ?)`, [USER_ID]);
    await conn.execute(`DELETE FROM health_checkup_template WHERE user_id = ?`, [USER_ID]);

    let tplCount = 0;
    let itemCount = 0;
    for (const t of tplData.rows) {
        const tplId = genUuid(`tpl_${t.id}_${t.name}`);
        const createdRaw = t.created_at || '';
        const updatedRaw = t.updated_at || '';

        // Find created_at/updated_at by trying ISO date pattern match on all values
        const allVals = Object.values(t);
        let foundCreated = '', foundUpdated = '';
        for (const v of allVals) {
            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) {
                if (!foundCreated) foundCreated = v; else if (!foundUpdated) foundUpdated = v;
            }
        }
        const useCreated = foundCreated || new Date().toISOString().slice(0, 19).replace('T', ' ');
        const useUpdated = foundUpdated || foundCreated || new Date().toISOString().slice(0, 19).replace('T', ' ');

        await conn.execute(
            `INSERT INTO health_checkup_template (id, user_id, name, test_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [tplId, USER_ID, t.name, t.test_type, useCreated, useUpdated]
        );
        tplCount++;

        // Extract items from raw CSV line (handle JSON-with-commas-in-quoted-field)
        const rawLines = tplContent.split('\n').filter(l => l.trim());
        for (let li = 1; li < rawLines.length; li++) {
            const line = rawLines[li].trim();
            // Find the JSON array between outermost quotes after the 5th comma
            const jsonMatch = line.match(/,"(\[\{.*?\}\])",/s);
            if (jsonMatch) {
                try {
                    const items = JSON.parse(jsonMatch[1].replace(/""/g, '"'));
                    if (Array.isArray(items)) {
                        for (const item of items) {
                            const itemId = genUuid(`ti_${tplId}_${item.test_name}`);
                            await conn.execute(
                                `INSERT INTO health_checkup_template_item (id, template_id, test_name, unit, reference_range, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
                                [itemId, tplId, item.test_name || '', item.unit || '', item.reference_range || '']
                            );
                            itemCount++;
                        }
                    }
                } catch (e) { /* skip unparseable */ }
            }
        }
    }
    console.log(`✓ Inserted ${tplCount} templates + ${itemCount} template items`);

    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // Verify
    const [rows] = await conn.query(`
        SELECT 'checkup_records' AS t, COUNT(*) AS c FROM health_checkup_record WHERE user_id = ?
        UNION ALL SELECT 'checkup_templates', COUNT(*) FROM health_checkup_template WHERE user_id = ?
        UNION ALL SELECT 'template_items', COUNT(*) FROM health_checkup_template_item
    `, [USER_ID, USER_ID]);

    console.log('\n=== Migration Result ===');
    rows.forEach(r => console.log(`  ${r.t}: ${r.c} rows`));

    await conn.end();
    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
