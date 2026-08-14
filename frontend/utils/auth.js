/**
 * 请求工具模块（已移除微信登录，改用设备标识区分用户归属）
 */
const { request } = require('../services/request');

/**
 * 带认证的请求封装：转发给统一 request，自动携带设备 ID（未登录时后端据此区分用户）
 */
function requestWithAuth(options) {
  return request({ ...options });
}

module.exports = {
  requestWithAuth,
};
