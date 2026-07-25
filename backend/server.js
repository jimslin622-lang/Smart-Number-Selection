const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const config = require('./config');
const { ok, fail, notFound } = require('./response');
const { templates, buildExample, buildHistory, buildAnalysis, getTemplate } = require('./data');
const { generateById, formatDisplay, formatText, parseDisplay } = require('./random');
const { fetchMarkSixResults } = require('./hkjc-marksix');
const { pingDb, closePool, hasDbConfig, getPool } = require('./db/client');
const repo = require('./db/repository');
const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

function generateId() {
  return crypto.randomBytes(6).toString('hex');
}

// 确保 exports 目录存在
const exportsDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}
// 启动时清理超过1小时的残留文件
const ONE_HOUR = 3600000;
fs.readdirSync(exportsDir).forEach(file => {
  const filepath = path.join(exportsDir, file);
  try {
    if (Date.now() - fs.statSync(filepath).mtimeMs > ONE_HOUR) {
      fs.unlinkSync(filepath);
      console.log('[cleanup] removed stale file:', file);
    }
  } catch (e) {}
});

function withCors(headers = {}) {
  return {
    'Access-Control-Allow-Origin': config.corsOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,PUT,DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, X-Request-Id, Authorization',
    ...headers,
  };
}

function formatDate(dateValue) {
  if (!dateValue) return '';
  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${Number(match[2])}月${Number(match[3])}日`;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return String(dateValue);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function normalizeNumbers(typeId, numbers) {
  if (!numbers) return { parsed: [], numberList: [] };
  const n = numbers;
  let parsed = [];
  let numberList = [];

  if (n.normal) {
    const main = n.normal.map(String);
    const special = n.special != null ? [String(n.special)] : [];
    parsed = [
      { label: '主码', numbers: main },
      ...(special.length ? [{ label: '附加号', numbers: special }] : []),
    ];
    numberList = main.concat(special);
  } else if (n.red && n.blue) {
    const red = n.red.map(String);
    const blue = n.blue.map(String);
    parsed = [
      { label: '红球', numbers: red },
      { label: '蓝球', numbers: blue },
    ];
    numberList = red.concat(blue);
  } else if (n.front && n.back) {
    const front = n.front.map(String);
    const back = n.back.map(String);
    parsed = [
      { label: '前区', numbers: front },
      { label: '后区', numbers: back },
    ];
    numberList = front.concat(back);
  } else if (n.numbers) {
    const nums = n.numbers.map(String);
    const special = n.special != null ? [String(n.special)] : [];
    if (special.length) {
      parsed = [
        { label: '号码', numbers: nums },
        { label: '附加号', numbers: special },
      ];
      numberList = nums.concat(special);
    } else {
      parsed = [{ label: '号码', numbers: nums }];
      numberList = nums;
    }
  }

  return { parsed, numberList };
}

function getNextIssue(issue) {
  if (!issue) return '';
  if (issue.includes('/')) {
    const parts = issue.split('/');
    const num = parseInt(parts[1], 10);
    if (isNaN(num)) return '';
    return `${parts[0]}/${String(num + 1).padStart(parts[1].length, '0')}`;
  }
  const num = parseInt(issue, 10);
  if (isNaN(num)) return '';
  return String(num + 1);
}

function normalizeHistoryRow(row) {
  if (!row) return null;
  const typeId = row.typeId || row.type_id || row.lottery_code;
  const tpl = getTemplate(typeId);
  if (row.lottery_code) {
    const { parsed, numberList } = normalizeNumbers(typeId, row.numbers);
    const display = parsed.map(p => `${p.label}：${p.numbers.join(' ')}`).join('\n');
    const formatted = parsed.map(p => `${p.label}:${p.numbers.join(',')}`).join(' ');
    return {
      typeId,
      type: tpl.name,
      period: row.issue,
      date: formatDate(row.draw_date),
      raw: row.numbers,
      formatted,
      display,
      parsed,
      numberList,
      source: row.data_source || undefined,
    };
  }
  const parsed = parseDisplay(row.display);
  return {
    typeId,
    type: tpl.name,
    period: row.period,
    date: formatDate(row.date),
    raw: row.raw,
    formatted: row.formatted,
    display: row.display,
    parsed,
    numberList: parsed.flatMap(group => group.numbers),
    source: row.source || undefined,
  };
}

async function getRealHistory(typeId, count) {
  if (typeId !== 'lhc') return null;
  try {
    return await fetchMarkSixResults(count);
  } catch (err) {
    console.warn('HKJC Mark Six fetch failed, falling back to database/local data:', err.message);
    return null;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (err) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

// 从数组中随机取 k 个元素
function pickK(arr, k) {
  const result = [];
  const pool = [...arr];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result.sort((a, b) => a - b);
}

// 生成剩余组合
function generateRemaining(lotteryCode, excludedSet, limit) {
  const remaining = [];
  const maxAttempts = limit * 100;
  let attempts = 0;
  
  // fc3d/pl3: 全量穷举 000-999
  if (lotteryCode === 'fc3d' || lotteryCode === 'pl3') {
    for (let i = 0; i < 1000; i++) {
      const digits = String(i).padStart(3, '0').split('').map(Number);
      const key = digits.join(',');
      if (!excludedSet.has(key)) {
        remaining.push({ main: digits, extra: [] });
        if (remaining.length >= limit) break;
      }
    }
    return remaining;
  }
  
  // 大彩种：随机采样
  while (remaining.length < limit && attempts < maxAttempts) {
    attempts++;
    let main, extra, key;
    
    if (lotteryCode === 'lhc') {
      main = pickK(range(1, 49), 6);
      const remainingNums = range(1, 49).filter(n => !main.includes(n));
      extra = [remainingNums[Math.floor(Math.random() * remainingNums.length)]];
      key = main.join(',') + '|' + extra.join(',');
    } else if (lotteryCode === 'ssq') {
      main = pickK(range(1, 33), 6);
      extra = [Math.floor(Math.random() * 16) + 1];
      key = main.join(',') + '|' + extra.join(',');
    } else if (lotteryCode === 'dlt') {
      main = pickK(range(1, 35), 5);
      extra = pickK(range(1, 12), 2);
      key = main.join(',') + '|' + extra.join(',');
    } else if (lotteryCode === 'qlc') {
      main = pickK(range(1, 30), 7);
      extra = [];
      key = main.join(',');
    } else if (lotteryCode === 'qxc') {
      main = [];
      for (let i = 0; i < 7; i++) main.push(Math.floor(Math.random() * 10));
      extra = [];
      key = main.join(',');
    } else if (lotteryCode === 'pl5') {
      main = [];
      for (let i = 0; i < 5; i++) main.push(Math.floor(Math.random() * 10));
      extra = [];
      key = main.join(',');
    } else if (lotteryCode === 'kl8') {
      main = pickK(range(1, 80), 10);
      extra = [];
      key = main.join(',');
    } else {
      // 默认：简单随机
      main = pickK(range(1, 33), 6);
      extra = [];
      key = main.join(',');
    }
    
    if (!excludedSet.has(key)) {
      excludedSet.add(key); // 避免重复
      remaining.push({ main, extra });
    }
  }
  
  return remaining;
}

function range(lo, hi) {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

function parseTextToRows(text, typeName, period, includeScore) {
  if (includeScore) {
    return parseWithScore(text, typeName, period);
  } else {
    return parseSimple(text, typeName, period);
  }
}

function parseSimple(text, typeName, period) {
  const rows = [['序号', '彩种', '期号', '号码']];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    const numMatch = trimmed.match(/^第\s*(\d+)\s*注[：:]\s*(.+)/);
    if (numMatch) {
      rows.push([String(parseInt(numMatch[1])), typeName, period, numMatch[2].trim()]);
    }
  }
  
  return rows.length > 1 ? rows : [['无数据']];
}

function parseWithScore(text, typeName, period) {
  const rows = [['序号', '彩种', '期号', '号码', '得分', '维度']];
  const lines = text.split('\n');
  
  let entryNum = null;
  let entryNums = '';
  let entryScore = '';
  let entryDims = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    const numMatch = trimmed.match(/^第\s*(\d+)\s*注[：:]\s*(.+)/);
    const scoreMatch = trimmed.match(/^得分[：:]\s*(.+)/);
    
    if (numMatch) {
      if (entryNum !== null) {
        rows.push([String(entryNum), typeName, period, entryNums, entryScore, entryDims]);
      }
      entryNum = parseInt(numMatch[1]);
      entryNums = numMatch[2].trim();
      entryScore = '';
      entryDims = '';
    } else if (scoreMatch) {
      entryScore = scoreMatch[1].trim();
    } else if (trimmed.match(/^[^\s]+[：:].+/) && entryNum !== null && entryScore) {
      entryDims = trimmed;
    }
  }
  
  if (entryNum !== null) {
    rows.push([String(entryNum), typeName, period, entryNums, entryScore, entryDims]);
  }
  
  return rows.length > 1 ? rows : [['无数据']];
}

function log(req, status, startedAt) {
  if (config.logLevel === 'silent') return;
  const ms = Date.now() - startedAt;
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${status} ${ms}ms`);
}

async function route(req, res) {
    const startedAt = Date.now();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const reqPath = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id, Authorization');

    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, withCors()); res.end(); log(req, 204, startedAt); return; }

      if (req.method === 'GET' && reqPath === '/health') {
      let db = { configured: hasDbConfig(), ok: false };
      try { db = await pingDb(); } catch (err) { db = { configured: hasDbConfig(), ok: false, error: err.message }; }
      ok(res, { status: 'ok', env: config.env, version: config.version, db, time: new Date().toISOString() });
      log(req, 200, startedAt); return;
    }

      // 认证 API
      if (req.method === 'POST' && reqPath === '/api/v1/auth/login') { req.body = await readBody(req); return authRoutes.login(req, res); }
      if (req.method === 'GET' && reqPath === '/api/v1/auth/me') { authMiddleware(req, res, () => authRoutes.me(req, res)); return; }
      if (req.method === 'PUT' && reqPath === '/api/v1/auth/profile') { authMiddleware(req, res, async () => { req.body = await readBody(req); authRoutes.updateProfile(req, res); }); return; }

      if (req.method === 'GET' && reqPath === '/api/v1/version') { ok(res, { name: 'random-number-helper-api', version: config.version, env: config.env, dbConfigured: hasDbConfig() }); log(req, 200, startedAt); return; }

      if (req.method === 'GET' && reqPath === '/api/v1/templates') {
      const types = await repo.listLotteryTypes().catch(() => null);
      if (types && types.length) {
        const counts = await repo.getDrawSummary().catch(() => null);
        const countMap = {};
        if (counts) counts.forEach(c => { countMap[c.lottery_code] = c.count; });
        ok(res, types.map(t => ({
          id: t.code, name: t.name, desc: `${t.category} ${t.country}`,
          weeklyDraws: t.draw_days?.days?.length || 0, drawDays: t.draw_days?.days || [],
          iconText: t.code.slice(0, 1).toUpperCase(), historyCount: countMap[t.code] || 0,
        })));
      } else {
        const { templates } = require('./data');
        ok(res, templates);
      }
      log(req, 200, startedAt); return;
    }

    if (req.method === 'GET' && reqPath === '/api/v1/examples/latest') {
      const typeId = url.searchParams.get('typeId') || 'lhc';
      const dbRow = await repo.getLatestHistory(typeId).catch(() => null);
      if (dbRow) {
        const row = normalizeHistoryRow(dbRow);
        row.nextIssue = getNextIssue(row.period);
        ok(res, row); log(req, 200, startedAt); return;
      }
      const realRows = await getRealHistory(typeId, 1);
      let row = realRows && realRows.length ? realRows[0] : buildExample(typeId);
      if (row) row.nextIssue = getNextIssue(row.period);
      ok(res, row);
      log(req, 200, startedAt); return;
    }

    if (req.method === 'GET' && reqPath === '/api/v1/examples/history') {
      const typeId = url.searchParams.get('typeId') || 'lhc';
      const count = url.searchParams.get('count') || 20;
      const dbRows = await repo.listHistory(typeId, count).catch(() => null);
      if (dbRows && dbRows.length) { ok(res, dbRows.map(normalizeHistoryRow)); log(req, 200, startedAt); return; }
      const realRows = await getRealHistory(typeId, count);
      ok(res, realRows && realRows.length ? realRows : buildHistory(typeId, count));
      log(req, 200, startedAt); return;
    }

    if (req.method === 'GET' && reqPath === '/api/v1/analysis') { const typeId = url.searchParams.get('typeId') || 'lhc'; ok(res, buildAnalysis(typeId)); log(req, 200, startedAt); return; }

    if (req.method === 'GET' && reqPath === '/api/v1/stats') {
      const typeId = url.searchParams.get('typeId') || 'lhc';
      const stats = await repo.listNumberStats(typeId).catch(() => null);
      ok(res, stats && stats.length ? stats : []);
      log(req, 200, startedAt); return;
    }

    // period_records API
    if (reqPath.startsWith('/api/v1/period-records')) { await handlePeriodRecords(req, res, url, startedAt); return; }

    // 获取排除的号码组（所有用户已随机 + 已开奖）
    if (req.method === 'GET' && reqPath === '/api/v1/export/excluded') {
      const lotteryCode = url.searchParams.get('lottery') || 'lhc';
      const period = url.searchParams.get('period') || '';
      const pool = getPool();
      
      const excluded = [];
      
      if (pool && period) {
        // 所有用户随机过的号码
        const userRecords = await pool.query(
          'SELECT main_numbers, extra_numbers FROM period_records WHERE lottery_code = $1 AND period = $2',
          [lotteryCode, period]
        ).catch(() => ({ rows: [] }));
        
        userRecords.rows.forEach(r => {
          const main = (r.main_numbers || '').toString().split(',').filter(Boolean).map(n => n.trim());
          const extra = r.extra_numbers ? r.extra_numbers.toString().split(',').filter(Boolean).map(n => n.trim()) : [];
          excluded.push({ main, extra });
        });
      }
      
      // 已开奖数据
      const drawRecords = await pool.query(
        'SELECT numbers FROM lottery_draw WHERE lottery_code = $1 ORDER BY draw_date DESC LIMIT 300',
        [lotteryCode]
      ).catch(() => ({ rows: [] }));
      
      drawRecords.rows.forEach(r => {
        const nums = r.numbers || {};
        if (nums.normal) {
          excluded.push({ main: nums.normal.map(String), extra: nums.special ? [String(nums.special)] : [] });
        } else if (nums.red) {
          excluded.push({ main: nums.red.map(String), extra: nums.blue ? nums.blue.map(String) : [] });
        } else if (nums.front) {
          excluded.push({ main: nums.front.map(String), extra: nums.back ? nums.back.map(String) : [] });
        }
      });
      
      ok(res, { lottery_code: lotteryCode, period, excluded });
      log(req, 200, startedAt); return;
    }

    // 生成剩余组合（排除用户已随机 + 已开奖）
    if (req.method === 'GET' && reqPath === '/api/v1/export/remaining') {
      const lotteryCode = url.searchParams.get('lottery') || 'lhc';
      const period = url.searchParams.get('period') || '';
      const limit = Math.min(Number(url.searchParams.get('limit')) || 10000, 50000);
      console.log('[remaining] lottery:', lotteryCode, 'period:', period, 'limit:', limit);
      
      const pool = getPool();
      const excludedSet = new Set();
      
      if (pool && period) {
        const userRecords = await pool.query(
          'SELECT main_numbers, extra_numbers FROM period_records WHERE lottery_code = $1 AND period = $2',
          [lotteryCode, period]
        ).catch(() => ({ rows: [] }));
        
        userRecords.rows.forEach(r => {
          const main = (r.main_numbers || '').toString().split(',').filter(Boolean).map(n => n.trim()).sort().join(',');
          const extra = r.extra_numbers ? r.extra_numbers.toString().split(',').filter(Boolean).map(n => n.trim()).sort().join(',') : '';
          excludedSet.add(main + (extra ? '|' + extra : ''));
        });
        
        const drawRecords = await pool.query(
          'SELECT numbers FROM lottery_draw WHERE lottery_code = $1 ORDER BY draw_date DESC LIMIT 300',
          [lotteryCode]
        ).catch(() => ({ rows: [] }));
        
        drawRecords.rows.forEach(r => {
          const nums = r.numbers || {};
          if (nums.normal) {
            const main = nums.normal.map(String).sort().join(',');
            const extra = nums.special ? [String(nums.special)] : [];
            excludedSet.add(main + (extra.length ? '|' + extra.sort().join(',') : ''));
          } else if (nums.red) {
            const main = nums.red.map(String).sort().join(',');
            const extra = nums.blue ? nums.blue.map(String).sort().join(',') : [];
            excludedSet.add(main + (extra.length ? '|' + extra.sort().join(',') : ''));
          } else if (nums.front) {
            const main = nums.front.map(String).sort().join(',');
            const extra = nums.back ? nums.back.map(String).sort().join(',') : [];
            excludedSet.add(main + (extra.length ? '|' + extra.sort().join(',') : ''));
          }
        });
      }
      
      const remaining = generateRemaining(lotteryCode, excludedSet, limit);
      console.log('[remaining] excluded:', excludedSet.size, 'remaining:', remaining.length);
      ok(res, { lottery_code: lotteryCode, period, excludedCount: excludedSet.size, remainingCount: remaining.length, remaining });
      log(req, 200, startedAt); return;
    }

    // 用户记录 API
    if (reqPath.startsWith('/api/v1/records')) { authMiddleware(req, res, async () => { await handleRecords(req, res, url, startedAt); }); return; }

    if (req.method === 'POST' && reqPath === '/api/v1/random/generate') {
      const body = await readBody(req);
      const typeId = body.typeId || 'lhc';
      const count = Math.min(Math.max(Number(body.count) || 1, 1), 20);
      const tpl = getTemplate(typeId);
      const list = Array.from({ length: count }, () => {
        const raw = generateById(tpl.id);
        const display = formatDisplay(tpl.id, raw);
        return { typeId: tpl.id, type: tpl.name, raw, formatted: formatText(tpl.id, raw), display, parsed: parseDisplay(display) };
      });
      ok(res, count === 1 ? list[0] : list);
      log(req, 200, startedAt); return;
    }

    // 导出文件 API
    if (req.method === 'POST' && reqPath === '/api/v1/export') {
      try {
        const body = await readBody(req);
        const content = body.content || '';
        const typeName = body.typeName || '';
        const period = body.period || '';
        const includeScore = body.includeScore !== false;
        const filename = (body.filename || 'export') + '.xlsx';
        
        // 生成唯一文件名
        const fileId = crypto.randomBytes(16).toString('hex');
        const safeFilename = fileId + '_' + filename.replace(/[\\/:*?"<>|]/g, '_');
        const filepath = path.join(exportsDir, safeFilename);
        
        console.log('Writing xlsx to:', filepath);
        
        // 将文本内容解析为 Excel 数据
        const rows = parseTextToRows(content, typeName, period, includeScore);
        
        // 创建 workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        
        // 设置列宽
        ws['!cols'] = [
          { wch: 10 },  // 序号
          { wch: 12 },  // 彩种
          { wch: 12 },  // 期号
          { wch: 30 },  // 号码
          { wch: 10 },  // 得分
          { wch: 35 },  // 维度
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, '导出数据');
        
        // 写入 xlsx 文件
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        fs.writeFileSync(filepath, buffer);
        
        console.log('Xlsx file written successfully');
        
        // 返回下载 URL
        const downloadUrl = `http://127.0.0.1:3000/api/v1/export/download/${safeFilename}`;
        ok(res, { downloadUrl, filename: safeFilename });
        log(req, 200, startedAt); return;
      } catch (err) {
        console.error('Export error:', err);
        fail(res, 500, err.message || 'Export failed');
        log(req, 500, startedAt); return;
      }
    }

    // 下载文件 API
    if (req.method === 'GET' && reqPath.startsWith('/api/v1/export/download/')) {
      try {
        const rawFilename = reqPath.split('/').pop();
        console.log('[download] Raw filename from URL:', rawFilename);
        
        const filename = decodeURIComponent(rawFilename);
        console.log('[download] Decoded filename:', filename);
        
        const filepath = path.join(exportsDir, filename);
        console.log('[download] Full filepath:', filepath);
        
        if (!fs.existsSync(filepath)) {
          console.error('[download] File not found:', filepath);
          console.error('[download] Files in exports dir:', fs.readdirSync(exportsDir));
          notFound(res);
          log(req, 404, startedAt); return;
        }
        
        const stat = fs.statSync(filepath);
        const readStream = fs.createReadStream(filepath);
        
        const isXlsx = filename.endsWith('.xlsx');
        const contentType = isXlsx 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/plain; charset=utf-8';
        
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          'Content-Length': stat.size,
          ...withCors()
        });
        
      readStream.pipe(res);
      // 下载完成后删除文件
      res.on('finish', () => {
        fs.unlink(filepath, (err) => {
          if (err) console.warn('[download] cleanup failed:', err.message);
          else console.log('[download] cleaned up:', filename);
        });
      });
      log(req, 200, startedAt); return;
      } catch (err) {
        console.error('[download] Error:', err);
        console.error('[download] Error stack:', err.stack);
        fail(res, 500, err.message || 'Download failed');
        log(req, 500, startedAt); return;
      }
    }

    notFound(res);
    log(req, 404, startedAt);
  } catch (err) {
    fail(res, 500, err.message || 'Internal Server Error', 'INTERNAL_ERROR');
    log(req, 500, startedAt);
  }
}

async function handlePeriodRecords(req, res, url, startedAt) {
  const handlerPath = url.pathname;
  const pool = getPool();

  if (req.method === 'GET' && handlerPath === '/api/v1/period-records/numbers') {
    const lotteryCode = url.searchParams.get('lottery') || 'lhc';
    const period = url.searchParams.get('period') || '';
    if (!pool) { ok(res, []); log(req, 200, startedAt); return; }
    // 返回所有已随机过的整组号码
    const result = await pool.query('SELECT main_numbers, extra_numbers FROM period_records WHERE lottery_code = $1 AND period = $2 ORDER BY id', [lotteryCode, period]);
    ok(res, { lottery_code: lotteryCode, period, groups: result.rows });
    log(req, 200, startedAt); return;
  }

  if (req.method === 'GET' && handlerPath === '/api/v1/period-records/export') {
    const lotteryCode = url.searchParams.get('lottery') || 'lhc';
    const period = url.searchParams.get('period') || '';
    if (!pool) { ok(res, []); log(req, 200, startedAt); return; }
    const result = await pool.query('SELECT main_numbers, extra_numbers, created_at FROM period_records WHERE lottery_code = $1 AND period = $2 ORDER BY id', [lotteryCode, period]);
    ok(res, { lottery_code: lotteryCode, period, records: result.rows });
    log(req, 200, startedAt); return;
  }

  if (req.method === 'POST' && handlerPath === '/api/v1/period-records/append') {
    const body = await readBody(req);
    if (!pool) { fail(res, 500, 'Database not configured'); log(req, 500, startedAt); return; }
    const lotteryCode = body.lottery || 'lhc';
    const period = body.period || '';
    const mainNumbers = body.main_numbers || [];
    const extraNumbers = body.extra_numbers || [];
    if (!period) { fail(res, 400, 'missing period'); log(req, 400, startedAt); return; }
    if (!mainNumbers.length) { ok(res, { inserted: false }); log(req, 200, startedAt); return; }
    // 生成 hash 用于快速查重：主号码排序 + 副号码排序后逗号拼接
    const sortedMain = [...mainNumbers].sort((a,b) => Number(a)-Number(b));
    const sortedExtra = [...extraNumbers].sort((a,b) => Number(a)-Number(b));
    const numHash = sortedMain.join(',') + (sortedExtra.length ? '|' + sortedExtra.join(',') : '');
    // 已存在则跳过
    const exist = await pool.query('SELECT id FROM period_records WHERE lottery_code = $1 AND period = $2 AND num_hash = $3', [lotteryCode, period, numHash]);
    if (exist.rows.length) { ok(res, { inserted: false, duplicate: true }); log(req, 200, startedAt); return; }
    await pool.query('INSERT INTO period_records (id, lottery_code, period, main_numbers, extra_numbers, num_hash) VALUES ($1, $2, $3, $4, $5, $6)', [generateId(), lotteryCode, period, mainNumbers.join(','), extraNumbers.join(','), numHash]);
    ok(res, { inserted: true });
    log(req, 200, startedAt); return;
  }

  if (req.method === 'DELETE' && handlerPath === '/api/v1/period-records') {
    const body = await readBody(req);
    if (!pool) { fail(res, 500, 'Database not configured'); log(req, 500, startedAt); return; }
    await pool.query('DELETE FROM period_records WHERE lottery_code = $1 AND period = $2', [body.lottery || 'lhc', body.period || '']);
    ok(res, { deleted: true });
    log(req, 200, startedAt); return;
  }

  notFound(res);
  log(req, 404, startedAt);
}

async function handleRecords(req, res, url, startedAt) {
  const { openid } = req.user;
  const handlerPath = url.pathname;
  const pool = getPool();

  if (req.method === 'GET' && handlerPath === '/api/v1/records') {
    const lotteryCode = url.searchParams.get('lottery') || '';
    const starred = url.searchParams.get('starred') === 'true';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const offset = Number(url.searchParams.get('offset')) || 0;
    if (!pool) { ok(res, []); log(req, 200, startedAt); return; }
    let sql = 'SELECT * FROM user_records';
    const conditions = ['openid = $1'];
    const params = [openid];
    if (lotteryCode) { conditions.push('lottery_code = $' + (params.length + 1)); params.push(lotteryCode); }
    if (starred) conditions.push('starred = true');
    sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    const result = await pool.query(sql, params);
    ok(res, result.rows);
    log(req, 200, startedAt); return;
  }

  if (req.method === 'POST' && handlerPath === '/api/v1/records') {
    const body = await readBody(req);
    if (!pool) { fail(res, 500, 'Database not configured'); log(req, 500, startedAt); return; }
    const records = Array.isArray(body) ? body : [body];
    const inserted = [];
    for (const rec of records) {
      const id = generateId();
      const result = await pool.query(`
        INSERT INTO user_records (id, lottery_code, method_id, method_name, main_numbers, extra_numbers, display_text, score, score_dims, source, batch_id, period, openid)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13) RETURNING id
      `, [id, rec.lottery_code || 'lhc', rec.method_id || 'weighted', rec.method_name || '智能加权', rec.main_numbers || [], rec.extra_numbers || null, rec.display_text || '', rec.score || 0, JSON.stringify(rec.score_dims || {}), rec.source || 'manual', rec.batch_id || null, rec.period || '', openid]);
      inserted.push(result.rows[0].id);
      if (rec.period) {
        const mainNums = (rec.main_numbers || []).map(String);
        const extraNums = (rec.extra_numbers || []).map(String);
        if (mainNums.length) {
          const sortedMain = [...mainNums].sort((a,b) => Number(a)-Number(b));
          const sortedExtra = [...extraNums].sort((a,b) => Number(a)-Number(b));
          const numHash = sortedMain.join(',') + (sortedExtra.length ? '|' + sortedExtra.join(',') : '');
          const exist = await pool.query('SELECT id FROM period_records WHERE lottery_code = $1 AND period = $2 AND num_hash = $3', [rec.lottery_code || 'lhc', rec.period, numHash]);
          if (!exist.rows.length) {
            await pool.query('INSERT INTO period_records (id, lottery_code, period, main_numbers, extra_numbers, num_hash) VALUES ($1, $2, $3, $4, $5, $6)', [generateId(), rec.lottery_code || 'lhc', rec.period, mainNums.join(','), extraNums.join(','), numHash]);
          }
        }
      }
    }
    ok(res, { inserted: inserted.length, ids: inserted });
    log(req, 200, startedAt); return;
  }

  if (req.method === 'PUT' && handlerPath === '/api/v1/records/star') {
    const body = await readBody(req);
    if (!pool) { fail(res, 500, 'Database not configured'); log(req, 500, startedAt); return; }
    await pool.query('UPDATE user_records SET starred = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND openid = $3', [body.starred, body.id, openid]);
    ok(res, { ok: true });
    log(req, 200, startedAt); return;
  }

  if (req.method === 'DELETE' && handlerPath === '/api/v1/records') {
    const body = await readBody(req);
    if (!pool) { fail(res, 500, 'Database not configured'); log(req, 500, startedAt); return; }
    const ids = Array.isArray(body.ids) ? body.ids : [body.id];
    const placeholders = ids.map((_, i) => '$' + (i + 2)).join(',');
    await pool.query('DELETE FROM user_records WHERE id IN (' + placeholders + ') AND openid = $1', [openid, ...ids]);
    ok(res, { deleted: ids.length });
    log(req, 200, startedAt); return;
  }

  if (req.method === 'GET' && handlerPath === '/api/v1/records/summary') {
    const lotteryCode = url.searchParams.get('lottery') || 'lhc';
    if (!pool) { fail(res, 500, 'Database not configured'); log(req, 500, startedAt); return; }
    const latest = await pool.query('SELECT issue, draw_date FROM lottery_draw WHERE lottery_code = $1 ORDER BY draw_date DESC LIMIT 1', [lotteryCode]);
    const records = await pool.query('SELECT * FROM user_records WHERE lottery_code = $1 AND openid = $2 ORDER BY created_at DESC', [lotteryCode, openid]);
    ok(res, { lottery_code: lotteryCode, latest_issue: latest.rows[0]?.issue || null, latest_date: latest.rows[0]?.draw_date || null, total_records: records.rows.length, records: records.rows });
    log(req, 200, startedAt); return;
  }

  notFound(res);
  log(req, 404, startedAt);
}

const server = http.createServer(route);

server.listen(config.port, config.host, () => {
  console.log(`random-number-helper-api listening at http://${config.host}:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => { await closePool().catch(() => {}); process.exit(0); });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));