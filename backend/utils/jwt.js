/**
 * JWT 工具 — 生成和验证 token
 */
const jwt = require('jsonwebtoken');

// 生产环境请从环境变量读取密钥
const SECRET = process.env.JWT_SECRET || 'random-number-helper-dev-secret-key-2026';
const EXPIRES_IN = '30d'; // token 有效期 30 天

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verify(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { sign, verify };
