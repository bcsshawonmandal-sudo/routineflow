/**
 * server/turso.js — Turso (LibSQL) Cloud Database Driver
 * Direct, fast, high-performance LibSQL HTTP pipeline client.
 */

require('dotenv').config();

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'https://routine-tursosayshi.aws-ap-south-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

// Clean the base URL (convert libsql:// to https:// if needed)
const cleanUrl = TURSO_URL.replace(/^libsql:\/\//, 'https://').replace(/\/$/, '');
const PIPELINE_URL = `${cleanUrl}/v2/pipeline`;

/**
 * Format argument value for LibSQL pipeline protocol
 */
function formatArg(val) {
  if (val === null || val === undefined) {
    return { type: 'null' };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { type: 'integer', value: String(val) };
    }
    return { type: 'float', value: val };
  }
  if (typeof val === 'boolean') {
    return { type: 'integer', value: val ? '1' : '0' };
  }
  return { type: 'text', value: String(val) };
}

/**
 * Parse cell value from LibSQL response format
 */
function parseCell(cell) {
  if (!cell || cell.type === 'null') return null;
  if (cell.type === 'integer') return parseInt(cell.value, 10);
  if (cell.type === 'float') return parseFloat(cell.value);
  if (cell.type === 'text') return cell.value;
  return cell.value ?? null;
}

/**
 * Execute a SQL statement with parameters
 */
async function execute(sql, args = []) {
  if (!TURSO_TOKEN) {
    throw new Error('TURSO_AUTH_TOKEN is missing in environment variables.');
  }

  const formattedArgs = Array.isArray(args) 
    ? args.map(formatArg)
    : Object.keys(args).reduce((acc, k) => {
        acc[k] = formatArg(args[k]);
        return acc;
      }, {});

  const payload = {
    requests: [
      {
        type: 'execute',
        stmt: {
          sql,
          args: Array.isArray(formattedArgs) ? formattedArgs : undefined,
          named_args: !Array.isArray(formattedArgs) ? formattedArgs : undefined
        }
      },
      { type: 'close' }
    ]
  };

  const response = await fetch(PIPELINE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Turso HTTP Error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const firstResult = result.results?.[0];

  if (firstResult?.type === 'error') {
    throw new Error(`Turso SQL Error: ${firstResult.error?.message || JSON.stringify(firstResult.error)}`);
  }

  return firstResult?.response?.result || {};
}

/**
 * Query and return rows as an array of objects: [{ col1: val1, ... }]
 */
async function query(sql, args = []) {
  const result = await execute(sql, args);
  const cols = result.cols?.map(c => c.name) || [];
  const rawRows = result.rows || [];

  return rawRows.map(row => {
    const obj = {};
    cols.forEach((colName, index) => {
      obj[colName] = parseCell(row[index]);
    });
    return obj;
  });
}

/**
 * Execute multiple statements in batch (useful for migrations/schema init)
 */
async function batch(statements) {
  const requests = statements.map(sql => ({
    type: 'execute',
    stmt: { sql }
  }));
  requests.push({ type: 'close' });

  const response = await fetch(PIPELINE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Turso batch failed: ${err}`);
  }

  return await response.json();
}

/**
 * Initialize Database Schema on Turso
 */
async function initSchema() {
  console.log('🔄 Initializing Turso database schema...');
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS routine_templates (
      user_id TEXT PRIMARY KEY,
      tasks_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS daily_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      tasks_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_daily_user_date ON daily_records(user_id, date);`
  ];

  await batch(statements);
  console.log('✅ Turso database tables ready (users, routine_templates, daily_records, user_settings).');
}

module.exports = {
  execute,
  query,
  batch,
  initSchema
};
