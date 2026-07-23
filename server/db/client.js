const config = require('../config');

let pg = null;
let pool = null;

function hasDbConfig() {
  return Boolean(config.db && config.db.host && config.db.name && config.db.user);
}

function getPool() {
  if (!hasDbConfig()) return null;
  if (!pg) pg = require('pg');
  if (!pool) {
    pool = new pg.Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.name,
      user: config.db.user,
      password: config.db.password,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
      max: config.db.poolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });
  }
  return pool;
}

async function query(text, params = []) {
  const p = getPool();
  if (!p) throw new Error('Database is not configured');
  return p.query(text, params);
}

async function pingDb() {
  const p = getPool();
  if (!p) return { configured: false, ok: false };
  const result = await p.query('SELECT now() AS now');
  return { configured: true, ok: true, now: result.rows[0].now };
}

async function closePool() {
  if (pool) await pool.end();
}

module.exports = { hasDbConfig, getPool, query, pingDb, closePool };
