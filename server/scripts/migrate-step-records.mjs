// Migrate step records from run_records.db (SQLite) → LifeOS2 MySQL
// Usage: node scripts/migrate-step-records.mjs
// Prerequisites: run_records.db in project root, LifeOS2 MySQL running

import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const SQLITE3 = process.env.SQLITE3_PATH || 'C:/Env/platform-tools/sqlite3.exe';
const SQLITE_DB = join(__dirname, '..', '..', 'run_records.db');
const SOURCE_USER_NAME = '何宜蔚';

const MYSQL_CONFIG = {
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: '123456',
  database: 'lifeos',
};

// ── Step 1: Export SQLite data ────────────────────────────────────────────
console.log('[1/3] Exporting SQLite data from run_records.db...');

// Write query to temp file to avoid shell escaping issues with Chinese chars
const queryFile = join(__dirname, '..', '..', '.migrate_query.sql');
const query = `SELECT id as _old_id, steps, record_time, created_at, hour FROM step_records WHERE user_id = '${SOURCE_USER_NAME}' ORDER BY record_time ASC;`;
writeFileSync(queryFile, query, 'utf-8');

const result = spawnSync(SQLITE3, ['-json', SQLITE_DB], {
  input: query,
  encoding: 'utf-8',
  maxBuffer: 50 * 1024 * 1024,
});

unlinkSync(queryFile);

if (result.error) {
  console.error('Failed to run sqlite3:', result.error.message);
  process.exit(1);
}
if (result.stderr && !result.stdout) {
  console.error('sqlite3 error:', result.stderr);
  process.exit(1);
}

let rows;
try {
  rows = JSON.parse(result.stdout);
} catch {
  console.error('Failed to parse sqlite3 output. stdout length:', result.stdout.length);
  console.error('stdout preview:', result.stdout.slice(0, 500));
  process.exit(1);
}
console.log(`  → ${rows.length} records exported`);

// ── Step 2: Connect to MySQL ──────────────────────────────────────────────
console.log('[2/3] Connecting to MySQL...');
const mysql2 = require('mysql2/promise');
const pool = mysql2.createPool(MYSQL_CONFIG);

let targetUserId;
try {
  const [users] = await pool.query(
    'SELECT id, username FROM system_user_account WHERE username = ?',
    [SOURCE_USER_NAME],
  );
  if (users.length) {
    targetUserId = users[0].id;
    console.log(`  → Matched user: ${users[0].username} (${targetUserId})`);
  } else {
    // Fallback: use the first available user
    const [allUsers] = await pool.query('SELECT id, username FROM system_user_account LIMIT 5');
    if (allUsers.length === 0) {
      console.error('No users found in LifeOS2. Create a user first.');
      process.exit(1);
    }
    if (allUsers.length === 1) {
      targetUserId = allUsers[0].id;
      console.log(`  → Auto-mapped "${SOURCE_USER_NAME}" → ${allUsers[0].username} (${targetUserId})`);
    } else {
      console.log(`Source user "${SOURCE_USER_NAME}" not found. Available users:`);
      allUsers.forEach((u) => console.log(`  ${u.username} → ${u.id}`));
      console.log('\nSet TARGET_USER_ID env var to the correct UUID and re-run.');
      process.exit(1);
    }
  }
} catch (err) {
  console.error('MySQL connection failed:', err.message);
  process.exit(1);
}

if (process.env.TARGET_USER_ID) {
  targetUserId = process.env.TARGET_USER_ID;
  console.log(`  → Override: target user = ${targetUserId}`);
}

// ── Step 3: Insert all records ────────────────────────────────────────────
console.log('[3/3] Inserting records...');

function toMysqlDatetime(value) {
  if (!value) return null;
  const match = String(value).match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?/,
  );
  if (match) {
    return `${match[1]} ${match[2]}${match[3] || ':00'}`;
  }
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  return null;
}

let inserted = 0;
let errors = 0;

for (const row of rows) {
  const recTime = toMysqlDatetime(row.record_time);
  if (!recTime) {
    errors++;
    continue;
  }

  const id = randomUUID();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const createdAt = toMysqlDatetime(row.created_at) || now;
  const hour = row.hour != null ? Number(row.hour) : null;

  try {
    await pool.query(
      `INSERT INTO health_step_record (id, user_id, steps, hour, record_time, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      [id, targetUserId, row.steps, hour, recTime, createdAt, now],
    );
    inserted++;
  } catch (err) {
    errors++;
    if (errors <= 5) {
      console.error(`  Row ${row._old_id} error: ${err.message}`);
    }
  }

  if ((inserted + errors) % 200 === 0) {
    console.log(`  → ${inserted + errors}/${rows.length} (${inserted} inserted, ${errors} errors)`);
  }
}

console.log(`\nDone! ${inserted} inserted, ${errors} errors.`);
await pool.end();
