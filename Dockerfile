FROM docker.m.daocloud.io/library/node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY scripts ./scripts
COPY utils ./utils
COPY services ./services
COPY app.json project.config.json sitemap.json ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/server.js"]
