# 后期迁云 Checklist

## 服务器

- [ ] 购买云服务器，建议 Linux，Node.js 18+
- [ ] 开放 80/443 端口
- [ ] 上传 `server/` 目录和必要文档
- [ ] 设置环境变量：`NODE_ENV=production`、`HOST=127.0.0.1`、`PORT=3000`
- [ ] 使用 PM2 或 systemd 守护 Node 服务
- [ ] 配置日志轮转

## 域名与 HTTPS

- [ ] 准备 API 域名，例如 `api.example.com`
- [ ] 完成必要备案/解析
- [ ] 配置 Nginx/Caddy HTTPS 反向代理到 `127.0.0.1:3000`
- [ ] 验证 `https://api.example.com/health`

## 微信公众平台

- [ ] 在“开发管理 - 开发设置 - 服务器域名”添加 request 合法域名
- [ ] 域名必须 HTTPS，证书有效
- [ ] 小程序正式版不能依赖“不校验合法域名”

## 小程序代码

- [ ] 修改 `services/config.js`
  - `USE_REMOTE_API: true`
  - `API_BASE_URL: 'https://api.example.com'`
- [ ] 微信开发者工具预览测试
- [ ] 上传体验版
- [ ] 按 `docs/REVIEW_NOTES_ROUTE_B.md` 填写审核备注

## 回滚策略

- [ ] 保留上一版小程序代码
- [ ] 后端保留上一版 server 目录备份
- [ ] 若接口异常，可临时将 `USE_REMOTE_API` 改回 `false`，走本地 mock 数据版本重新上传
