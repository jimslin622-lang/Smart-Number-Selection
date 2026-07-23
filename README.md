# Smart-Number-Selection - 智能随机助手

项目已实现前后端分离架构。

## 项目结构

```text
lottery-app_v1/
├── frontend/              # 小程序前端（微信小程序）
│   ├── pages/
│   ├── components/
│   ├── utils/
│   ├── services/
│   ├── assets/
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── sitemap.json
│   └── project.config.json
├── backend/               # API 后端服务
│   ├── server.js
│   ├── config.js
│   ├── data.js
│   ├── random.js
│   ├── response.js
│   ├── db/
│   ├── middleware/
│   ├── routes/
│   └── scripts/
├── docs/                  # 文档
├── docker-compose.yml     # Docker 部署
└── README.md              # 说明
```

## 快速开始

### 开发模式

#### 1. 前端（小程序）
使用微信开发者工具打开项目根目录

#### 2. 后端
```bash
cd backend
node server.js
```

### Docker 部署

#### 方式一：一键部署
```bash
docker-compose up -d --build
```

#### 方式二：分步部署
```bash
# 1. 启动数据库
docker-compose up -d postgres

# 2. 启动 API 服务
docker-compose up -d api
```

## 配置说明

### 前端配置
编辑 `frontend/services/config.js`:
- USE_REMOTE_API: true/false
- API_BASE_URL: 后端 API 地址

### 后端配置
编辑 `backend/.env`:
```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
DB_HOST=postgres
DB_PORT=5432
...
```

## API 接口
- `GET /health` - 健康检查
- `GET /api/v1/version` - 版本号
- `GET /api/v1/templates` - 玩法列表
- `GET /api/v1/examples/latest` - 最新示例
- `GET /api/v1/examples/history` - 历史示例
- `GET /api/v1/analysis` - 统计分析
- `POST /api/v1/random/generate` - 随机生成
