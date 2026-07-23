const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index <= 0) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  });
}

loadEnvFile(path.join(__dirname, '.env'));

const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',
  version: process.env.APP_VERSION || '0.1.0-local',
  autoSeed: String(process.env.AUTO_SEED || 'false') === 'true',
  db: {
    host: process.env.DB_HOST || '',
    port: Number(process.env.DB_PORT || 5432),
    name: process.env.DB_NAME || '',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    ssl: String(process.env.DB_SSL || 'false') === 'true',
    poolMax: Number(process.env.DB_POOL_MAX || 10),
  },
};

module.exports = config;
