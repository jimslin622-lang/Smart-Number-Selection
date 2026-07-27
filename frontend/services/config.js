// 小程序接口配置
// 开发者工具本机联调使用 HTTP，需要关闭"不校验合法域名"。
// 正式版必须使用 HTTPS 合法域名，例如：https://api.example.com

const isDevTools = typeof wx !== 'undefined' && wx.getSystemInfoSync && /windows|mac/.test(wx.getSystemInfoSync().platform);

const API_CONFIG = {
  USE_REMOTE_API: true,
  API_BASE_URL: isDevTools ? 'http://localhost:3000' : 'https://zhinengxuanhao.cn',
  API_FALLBACK_BASE_URLS: [],
  TIMEOUT: 15000,
};

module.exports = API_CONFIG;
