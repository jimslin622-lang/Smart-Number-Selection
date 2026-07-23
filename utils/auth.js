/**
 * 微信登录工具模块
 */
const { request } = require('../services/request');

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/**
 * 微信登录：调 wx.login() → 后端换 token
 */
function login() {
  return new Promise((resolve, reject) => {
    // 先检查是否已有有效 token
    const token = getToken();
    if (token) {
      // 已有 token，直接获取用户信息
      getUserInfo().then(resolve).catch(() => {
        // token 失效，重新登录
        doLogin().then(resolve).catch(reject);
      });
      return;
    }
    doLogin().then(resolve).catch(reject);
  });
}

function doLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('微信登录失败: ' + (res.errMsg || 'unknown')));
          return;
        }
        // 调后端登录接口
        request({ path: '/api/v1/auth/login', method: 'POST', data: { code: res.code } })
          .then(data => {
            if (data && data.token) {
              saveToken(data.token);
              resolve(data);
            } else {
              reject(new Error('登录返回数据异常'));
            }
          })
          .catch(err => {
            reject(new Error(err.message || '登录失败'));
          });
      },
      fail(err) {
        reject(new Error(err.errMsg || 'wx.login 失败'));
      }
    });
  });
}

/**
 * 获取用户信息（从后端）
 */
function getUserInfo() {
  return request({ path: '/api/v1/auth/me' })
    .then(data => {
      if (data) {
        saveUser(data);
      }
      return data;
    });
}

/**
 * 更新用户昵称和头像
 */
function updateProfile(nickname, avatarUrl) {
  return request({ path: '/api/v1/auth/profile', method: 'PUT', data: { nickname, avatar_url: avatarUrl } });
}

/**
 * 获取带 token 的请求头
 */
function getAuthHeader() {
  const token = getToken();
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

/**
 * 带认证的请求封装
 */
function requestWithAuth(options) {
  const token = getToken();
  const headers = options.header || {};
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  return request({ ...options, header: headers });
}

// ===== Storage 操作 =====

function saveToken(token) {
  if (token) {
    wx.setStorageSync(TOKEN_KEY, token);
  }
}

function getToken() {
  try {
    return wx.getStorageSync(TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

function saveUser(user) {
  if (user) {
    wx.setStorageSync(USER_KEY, user);
  }
}

function getCachedUser() {
  try {
    return wx.getStorageSync(USER_KEY) || null;
  } catch (e) {
    return null;
  }
}

function clearAuth() {
  try {
    wx.removeStorageSync(TOKEN_KEY);
    wx.removeStorageSync(USER_KEY);
  } catch (e) {}
}

module.exports = {
  login,
  getUserInfo,
  updateProfile,
  getAuthHeader,
  requestWithAuth,
  getToken,
  getCachedUser,
  clearAuth,
};
