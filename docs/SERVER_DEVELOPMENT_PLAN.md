# 本机正式环境与后续迁云开发计划

## 目标

先在个人电脑上搭一个“准正式后端环境”，让小程序的数据接口、启动方式、环境变量、日志、健康检查、迁云路径都提前规范化。后期迁移到云服务器时，尽量只改域名、HTTPS、进程部署方式和环境变量。

## 关键现实限制

微信小程序正式版请求后端通常要求：

- HTTPS
- 已配置到微信公众平台 request 合法域名
- 公网可访问域名
- 域名和服务器备案/合规配置视实际地区和平台要求处理

所以本机电脑可以先作为开发/体验/准正式环境，但真正面向正式用户时，仍建议迁移到云服务器或云托管，并绑定 HTTPS 域名。

## 阶段计划

### P0：本机后端骨架

- [x] 新增 Node.js 后端服务，不依赖第三方包
- [x] 新增健康检查接口 `/health`
- [x] 新增版本接口 `/api/v1/version`
- [x] 新增彩种接口 `/api/v1/templates`
- [x] 新增示例接口 `/api/v1/examples/latest`
- [x] 新增历史开奖接口 `/api/v1/examples/history`
- [x] 新增随机生成接口 `/api/v1/random/generate`
- [x] 新增统计接口 `/api/v1/analysis`
- [x] 新增 `.env.example`
- [x] 新增本机启动脚本
- [x] 新增部署/迁移文档

### P1：小程序接入准备

- [x] 新增 `services/config.js`，统一配置 API_BASE_URL、USE_REMOTE_API
- [x] 新增 `services/request.js`，统一封装 wx.request
- [x] 改造 `services/lottery-api.js`，支持 mock/远程接口切换
- [ ] 页面层逐步改为调用 `services/lottery-api.js`，减少直接读 mock

### P2：本机准正式运行

- [ ] 在电脑上启动后端：`node server/server.js`
- [ ] 浏览器访问 `http://127.0.0.1:3000/health`
- [ ] 微信开发者工具中打开项目，开发阶段可勾选“不校验合法域名”测试 HTTP
- [ ] 将 `USE_REMOTE_API` 改为 `true` 做联调
- [ ] 体验版前恢复合法域名/HTTPS 配置策略

### P3：迁云准备

- [ ] 购买/准备云服务器
- [ ] 准备域名和 HTTPS 证书
- [ ] 配置反向代理，例如 Nginx/Caddy
- [ ] 配置进程守护，例如 PM2/systemd
- [ ] 微信公众平台添加 request 合法域名
- [ ] 小程序 `API_BASE_URL` 改为正式 HTTPS 域名

## 推荐目录

```text
server/
  server.js           # 后端入口
  config.js           # 环境配置
  data.js             # 彩种/示例数据
  random.js           # 随机生成逻辑
  response.js         # HTTP 响应工具
  .env.example        # 环境变量示例
scripts/
  start-server.cmd    # Windows 启动脚本
  health-check.cmd    # Windows 健康检查脚本
```

## 当前建议

先不引入数据库。彩票选号助手本质上不需要用户云端账号和云端存储，用户记录继续留在小程序本地存储，后端只提供彩种、示例、随机生成和统计数据。这样隐私风险低、部署简单、迁移成本低。
