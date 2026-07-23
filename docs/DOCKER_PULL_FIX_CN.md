# Docker 镜像拉取失败处理

当前执行 `docker compose up -d --build` 时失败在拉取：

```text
postgres:16-alpine
```

错误原因是 Docker Desktop 直连 Docker Hub 超时，不是项目配置问题。

## 方案 A：给 Docker Desktop 配置可用 registry mirror

Docker Desktop → Settings → Docker Engine，增加类似配置：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com"
  ]
}
```

保存并重启 Docker Desktop 后再执行：

```bash
docker compose up -d --build
```

镜像源可用性会变化，如果某个不可用，换你当前网络可访问的镜像源。

## 方案 B：手动导入镜像

如果另一台机器能拉取镜像：

```bash
docker pull postgres:16-alpine
docker save postgres:16-alpine -o postgres-16-alpine.tar
```

拷贝到本机后：

```bash
docker load -i postgres-16-alpine.tar
```

然后回到项目目录：

```bash
docker compose up -d --build
```

## 方案 C：先只跑本机 Node API

如果暂时不能拉 Docker 镜像，可以先继续使用本机 API：

```bash
node server/server.js
```

但数据库功能需要 PostgreSQL 可用后才能启用。
