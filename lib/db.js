// Postgres connection helpers using @neondatabase/serverless.
// Vercel's Neon integration auto-injects DATABASE_URL.

const { neon } = require('@neondatabase/serverless');

function connectionString() {
  const url = process.env.DATABASE_URL
           || process.env.POSTGRES_URL
           || process.env.POSTGRES_URL_NON_POOLING;
  if (!url) throw new Error('DATABASE_URL / POSTGRES_URL not set');
  return url;
}

let _sql;
function getSql() {
  if (_sql) return _sql;
  _sql = neon(connectionString());
  return _sql;
}

// Tagged-template wrapper that lazily resolves the SQL function.
// Returns rows directly (NOT { rows: [...] } like pg).
// Also exposes .query() for raw DDL strings.
function sql(strings, ...values) { return getSql()(strings, ...values); }
sql.query       = (...args) => getSql().query(...args);
sql.transaction = (...args) => getSql().transaction(...args);

let _ready = false;
async function ensureSchema() {
  if (_ready) return;
  const fs = require('fs');
  const path = require('path');
  const schemaPath = path.join(process.cwd(), 'sql', 'schema.sql');
  const raw = fs.readFileSync(schemaPath, 'utf8');
  const stripped = raw.replace(/--.*$/gm, '');
  const statements = stripped
    .split(/;\s*(?:\n|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  const sqlFn = getSql();
  for (const stmt of statements) {
    await sqlFn.query(stmt);
  }
  _ready = true;
}

module.exports = { sql, ensureSchema, getSql };
