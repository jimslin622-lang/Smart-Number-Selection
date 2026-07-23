# Docker 本地准生产数据库环境

## 目标

用 Docker Compose 在本机启动：

- PostgreSQL 16
- Node.js API 服务
- 真实数据库表结构
- 历史组合数据种子

## 当前容器

```text
postgres: random-number-postgres
api:      random-number-api
volume:   random_number_pgdata
```

## 启动

确保 Docker Desktop 已启动后，在项目目录执行：

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f api
```

健康检查：

```bash
node -e "fetch('http://127.0.0.1:3000/health').then(r=>r.text()).then(console.log)"
```

## 数据库

连接信息：

```text
host: 127.0.0.1
port: 5432
database: random_number_helper
user: random_user
password: random_pass_change_me
```

表：

- `templates`：彩票类型
- `history_numbers`：历史组合数据
- `api_events`：预留 API 事件日志

## 灌入历史数据

Compose 中 API 默认 `AUTO_SEED=true`，数据库为空时会自动灌入。

也可以手动执行：

```bash
docker compose exec api node server/scripts/seed-history.js
```

## 清空重建

危险操作，会删除数据库卷：

```bash
docker compose down -v
docker compose up -d --build
```

## 小程序联调

本机开发者工具联调：

1. 保持 Docker 服务运行
2. 打开 `services/config.js`
3. 设置 `USE_REMOTE_API: true`
4. `API_BASE_URL` 保持 `http://127.0.0.1:3000`
5. 开发者工具临时勾选“不校验合法域名”

正式上线时必须把 API 换成 HTTPS 公网域名。
