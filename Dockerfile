FROM docker.m.daocloud.io/library/node:20-alpine

WORKDIR /app

# 复制后端依赖
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

# 复制后端代码
COPY backend/server ./server
COPY backend/scripts ./scripts
COPY backend/utils ./utils
COPY backend/config ./config
COPY backend/db ./db
COPY backend/middleware ./middleware
COPY backend/routes ./routes

# 复制小程序配置（仅用于版本参考，非必需）
COPY frontend/app.json frontend/project.config.json ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/server.js"]
