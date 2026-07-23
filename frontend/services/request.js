const { API_BASE_URL, TIMEOUT, USE_REMOTE_API } = require('./config');

function buildUrl(baseUrl, path, query = {}) {
  const qs = Object.keys(query)
    .filter(key => query[key] !== undefined && query[key] !== null && query[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join('&');
  return `${baseUrl}${path}${qs ? '?' + qs : ''}`;
}

function getToken() {
  try {
    return wx.getStorageSync('auth_token') || '';
  } catch (e) {
    return '';
  }
}

function requestOnce({ baseUrl, path, method = 'GET', query, data, header }) {
  const url = buildUrl(baseUrl, path, query);
  const headers = { 'content-type': 'application/json', ...header };

  // 自动带上 token
  const token = getToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      timeout: TIMEOUT,
      header: headers,
      success(res) {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 0) {
          resolve(body.data);
        } else {
          const err = new Error(body.message || `HTTP ${res.statusCode}`);
          err.url = url;
          err.statusCode = res.statusCode;
          err.response = body;
          reject(err);
        }
      },
      fail(err) {
        const e = new Error(err.errMsg || 'request failed');
        e.url = url;
        e.raw = err;
        reject(e);
      }
    });
  });
}

function request(options) {
  if (!USE_REMOTE_API) {
    return Promise.reject({ message: 'remote api disabled', url: options && options.path });
  }
  return requestOnce({ ...options, baseUrl: API_BASE_URL }).catch(err => {
    return Promise.reject({ message: err.message || 'request failed', url: err.url, raw: err.raw || err.response });
  });
}

module.exports = { request };
