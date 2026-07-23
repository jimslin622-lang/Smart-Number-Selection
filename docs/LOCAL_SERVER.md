# 本机服务器运行说明

## 1. 启动后端

在项目目录运行：

```bash
node server/server.js
```

或 Windows 双击/运行：

```bat
scripts\start-server.cmd
```

默认监听：

```text
http://127.0.0.1:3000
```

## 2. 健康检查

```bash
curl http://127.0.0.1:3000/health
```

浏览器也可以打开：

```text
http://127.0.0.1:3000/health
```

## 3. API 列表

```text
GET  /health
GET  /api/v1/version
GET  /api/v1/templates
GET  /api/v1/examples/latest?typeId=lhc
GET  /api/v1/examples/history?typeId=lhc&count=20
GET  /api/v1/analysis?typeId=lhc
POST /api/v1/random/generate
```

POST 示例：

```json
{
  "typeId": "lhc",
  "count": 5
}
```

## 4. 小程序联调

打开：

```text
services/config.js
```

把：

```js
USE_REMOTE_API: false
```

改成：

```js
USE_REMOTE_API: true
```

开发者工具本地联调时，可临时勾选“不校验合法域名”。

正式版不能用 `http://127.0.0.1:3000`，必须换成 HTTPS 公网域名，并在微信公众平台配置 request 合法域名。

## 5. 后期迁云

迁移到云服务器时：

1. 上传整个项目或至少上传 `server/` 目录
2. 云服务器安装 Node.js 18+
3. 设置环境变量或复制 `server/.env.example` 为 `server/.env`
4. 启动 `node server/server.js`
5. 用 Nginx/Caddy 配置 HTTPS 反向代理
6. 微信公众平台配置 HTTPS API 域名
7. 修改小程序 `services/config.js` 的 `API_BASE_URL`
8. 重新上传小程序代码并提审
