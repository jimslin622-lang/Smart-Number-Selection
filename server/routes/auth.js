/**
 * 微信登录路由
 */
const { sign } = require('../utils/jwt');
const { ok, fail } = require('../response');
const { query, hasDbConfig } = require('../db/client');

// 微信小程序 appid / secret（从环境变量读取）
const APPID = process.env.WX_APPID || 'wx83dfcd155101e160';
const SECRET = process.env.WX_SECRET || '';

/**
 * POST /api/v1/auth/login
 * 接收 code，调微信接口换 openid，生成 token
 */
async function login(req, res) {
  const body = req.body || {};
  const code = body.code;

  if (!code) {
    return fail(res, 400, '缺少 code 参数');
  }

  // 调微信接口换 openid
  const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`;

  try {
    const https = require('https');
    const wxResp = await new Promise((resolve, reject) => {
      https.get(wxUrl, (wxRes) => {
        let data = '';
        wxRes.on('data', chunk => data += chunk);
        wxRes.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('微信接口返回格式错误')); }
        });
      }).on('error', reject);
    });

    if (wxResp.errcode) {
      return fail(res, 400, '微信登录失败: ' + (wxResp.errmsg || 'unknown error'));
    }

    const openid = wxResp.openid;

    // 写入或更新用户
    if (hasDbConfig()) {
      await query(`
        INSERT INTO users (openid, last_login)
        VALUES ($1, CURRENT_TIMESTAMP)
        ON CONFLICT (openid) DO UPDATE SET last_login = CURRENT_TIMESTAMP
      `, [openid]);
    }

    // 生成 token
    const token = sign({ openid });

    ok(res, {
      token,
      openid,
    });
  } catch (err) {
    fail(res, 500, '登录失败: ' + err.message);
  }
}

/**
 * GET /api/v1/auth/me
 * 获取当前用户信息（含统计数据）
 */
async function me(req, res) {
  const openid = req.user ? req.user.openid : 'anonymous';

  if (openid === 'anonymous') {
    return ok(res, {
      openid: 'anonymous',
      nickname: '',
      avatar_url: '',
      stats: { total: 0, starred: 0, byLottery: [] },
    });
  }

  let userInfo = { nickname: '', avatar_url: '' };
  let stats = { total: 0, starred: 0, byLottery: [] };

  if (hasDbConfig()) {
    try {
      // 查用户信息
      const userResult = await query('SELECT nickname, avatar_url FROM users WHERE openid = $1', [openid]).catch(() => ({ rows: [] }));
      if (userResult.rows.length) {
        userInfo = userResult.rows[0];
      }

      // 查统计
      const totalResult = await query('SELECT count(*)::int AS count FROM user_records WHERE openid = $1', [openid]).catch(() => ({ rows: [{ count: 0 }] }));
      stats.total = totalResult.rows[0]?.count || 0;

      const starredResult = await query('SELECT count(*)::int AS count FROM user_records WHERE openid = $1 AND starred = true', [openid]).catch(() => ({ rows: [{ count: 0 }] }));
      stats.starred = starredResult.rows[0]?.count || 0;

      // 按玩法分布
      const byLotteryResult = await query(`
        SELECT lottery_code, count(*)::int AS count
        FROM user_records
        WHERE openid = $1
        GROUP BY lottery_code
        ORDER BY count DESC
      `, [openid]).catch(() => ({ rows: [] }));
      stats.byLottery = byLotteryResult.rows;
    } catch (e) {
      // 数据库错误时返回空数据
    }
  }

  ok(res, {
    openid,
    nickname: userInfo.nickname,
    avatar_url: userInfo.avatar_url,
    stats,
  });
}

/**
 * PUT /api/v1/auth/profile
 * 更新用户昵称和头像
 */
async function updateProfile(req, res) {
  const openid = req.user.openid;
  if (openid === 'anonymous') {
    return fail(res, 401, '请先登录');
  }

  const body = req.body || {};
  const nickname = body.nickname || '';
  const avatar_url = body.avatar_url || '';

  if (hasDbConfig()) {
    await query(`
      INSERT INTO users (openid, nickname, avatar_url, last_login)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (openid) DO UPDATE SET
        nickname = COALESCE(NULLIF($2, ''), users.nickname),
        avatar_url = COALESCE(NULLIF($3, ''), users.avatar_url),
        last_login = CURRENT_TIMESTAMP
    `, [openid, nickname, avatar_url]);
  }

  ok(res, { ok: true });
}

module.exports = { login, me, updateProfile };
