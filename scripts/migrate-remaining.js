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
        const vals = parseCSVLine(lines[i]); const row = {};
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

async function main() {
    console.log('Connecting to MySQL...');
    const conn = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: '123456', database: 'lifeos', charset: 'utf8mb4' });
    await conn.execute('SET NAMES utf8mb4');

    // === 1. Meal Records → Diet Record ===
    console.log('\n=== 1. Meal Records → Diet Record ===');
    const mealData = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'meal_records_202605281520.csv'), 'utf-8'));
    console.log(`Found ${mealData.rows.length} meal records`);
    let mealCnt = 0;
    for (const r of mealData.rows) {
        const id = genUuid(`meal_${r.id}_${r.meal_date}_${r.meal_type}`);
        try {
            await conn.execute(
                `INSERT INTO health_fitness_diet_record (id, user_id, date, meal_type, food_name, grams, calories, protein, carbs, fat, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, USER_ID, r.meal_date, r.meal_type, r.food_description, 0, Number(r.calories) || 0, Number(r.protein) || 0, Number(r.carbohydrates) || 0, Number(r.fat) || 0, r.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '), r.updated_at || r.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')]
            );
            mealCnt++;
        } catch (e) { console.log(`  Skip duplicate: ${r.meal_date} ${r.meal_type}`); }
    }
    console.log(`✓ Inserted ${mealCnt} diet records`);

    // === 2. Health Records → Weight Record (extract weight/height only) ===
    console.log('\n=== 2. Health Records → Weight Record ===');
    const hrData = parseCSV(fs.readFileSync(path.join(DATA_DIR, 'health_records_202605281520.csv'), 'utf-8'));
    console.log(`Found ${hrData.rows.length} health records`);
    let wtCnt = 0;
    for (const r of hrData.rows) {
        const id = genUuid(`hr_${r.id}_${r.record_date}`);
        try {
            await conn.execute(
                `INSERT INTO health_fitness_weight_record (id, user_id, date, weight, height, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, USER_ID, r.record_date, Number(r.weight) || 0, Number(r.height) || 173, r.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '), r.updated_at || r.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')]
            );
            wtCnt++;
            console.log(`  ${r.record_date}: weight=${r.weight}, height=${r.height} (BP:${r.blood_pressure_systolic}/${r.blood_pressure_diastolic} HR:${r.heart_rate} temp:${r.body_temperature} sugar:${r.blood_sugar} body_fat:${r.body_fat_percentage}% — only weight+height migrated)`);
        } catch (e) { console.log(`  Skip duplicate: ${r.record_date}`); }
    }
    console.log(`✓ Inserted ${wtCnt} weight records`);

    // Verify totals
    const [dietTotal] = await conn.query(`SELECT COUNT(*) as cnt FROM health_fitness_diet_record WHERE user_id = ?`, [USER_ID]);
    const [wtTotal] = await conn.query(`SELECT COUNT(*) as cnt FROM health_fitness_weight_record WHERE user_id = ?`, [USER_ID]);
    console.log('\n=== Final Totals ===');
    console.log(`  diet_record total: ${dietTotal[0].cnt} (was 84, now +${mealCnt})`);
    console.log(`  weight_record total: ${wtTotal[0].cnt} (was 18, now +${wtCnt})`);

    await conn.end();
    console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
