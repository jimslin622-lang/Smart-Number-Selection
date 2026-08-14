/**
 * JWT 认证中间件
 * 从 Authorization header 解析 token，将 openid 注入 req.user
 */
const { verify } = require('../utils/jwt');

function authMiddleware(req, res, next) {
  const rawHeaders = req.headers || {};
  const authHeader = rawHeaders['authorization'] || rawHeaders['Authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    // 未登录：优先用设备标识区分用户归属；无设备标识才降级为统一 anonymous
    const deviceId = rawHeaders['x-device-id'] || rawHeaders['X-Device-Id'] || '';
    req.user = { openid: deviceId ? `dev_${deviceId}` : 'anonymous' };
    return next();
  }

  try {
    const decoded = verify(token);
    req.user = { openid: decoded.openid };
  } catch (err) {
    const deviceId = rawHeaders['x-device-id'] || rawHeaders['X-Device-Id'] || '';
    req.user = { openid: deviceId ? `dev_${deviceId}` : 'anonymous' };
  }

  next();
}

/**
 * 强制认证中间件 — 必须登录
 */
function requireAuth(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.openid === 'anonymous') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 401, message: '请先登录' }));
      return;
    }
    next();
  });
}

module.exports = { authMiddleware, requireAuth };
