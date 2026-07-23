const fs = require('fs');
const path = require('path');
const { templates } = require('../data');
const { generateById, formatDisplay, formatText } = require('../random');

const root = path.resolve(__dirname, '..', '..');
let ok = true;

function assert(condition, message) {
  if (!condition) {
    ok = false;
    console.error('FAIL', message);
  } else {
    console.log('OK  ', message);
  }
}

for (const file of ['app.json', 'project.config.json', 'project.private.config.json', 'sitemap.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    assert(true, `JSON ${file}`);
  } catch (err) {
    assert(false, `JSON ${file}: ${err.message}`);
  }
}

for (const tpl of templates) {
  const raw = generateById(tpl.id);
  assert(Boolean(raw), `generate ${tpl.id}`);
  assert(Boolean(formatDisplay(tpl.id, raw)), `display ${tpl.id}`);
  assert(Boolean(formatText(tpl.id, raw)), `formatted ${tpl.id}`);
}

for (const file of [
  'server/server.js',
  'server/config.js',
  'server/db/init/001_schema.sql',
  'docker-compose.yml',
  'Dockerfile',
  'services/config.js',
  'services/request.js',
]) {
  assert(fs.existsSync(path.join(root, file)), `exists ${file}`);
}

process.exit(ok ? 0 : 1);
