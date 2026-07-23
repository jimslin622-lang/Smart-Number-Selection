// 小程序接口配置
// 开发者工具本机联调使用 HTTP，需要关闭"不校验合法域名"。
// 正式版必须使用 HTTPS 合法域名，例如：https://api.example.com

const API_CONFIG = {
  // 开发者工具 WebView/网络层不稳定时关闭远程 API，避免 wx.request timeout 红错。
  USE_REMOTE_API: true,
  API_BASE_URL: 'http://127.0.0.1:3000',
  // 只保留一个本机可用地址，避免开发者工具把 fallback 超时请求标红。
  API_FALLBACK_BASE_URLS: [],
  TIMEOUT: 15000,
};

module.exports = API_CONFIG;
