# 域名配置完整指南

## 📋 配置任务清单

- [x] 小程序前端配置修改
- [ ] 域名解析配置
- [ ] Nginx 配置
- [ ] SSL 证书申请
- [ ] 微信公众平台服务器域名配置

---

## 1️⃣ 域名解析配置

在您的域名注册商（如阿里云、腾讯云等）的 DNS 管理后台添加以下解析记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---------|---------|--------|-----|
| A | @ | 106.52.201.37 | 600 |
| A | www | 106.52.201.37 | 600 |

---

## 2️⃣ 服务器端 Nginx 配置

### SSH 登录服务器
```bash
ssh ubuntu@106.52.201.37
```

### 上传并配置 Nginx
```bash
# 进入项目目录
cd /home/ubuntu/lottery-app

# 复制 Nginx 配置文件
sudo cp deploy/nginx/zhinengxuanhao.cn.conf /etc/nginx/sites-available/

# 创建软链接
sudo ln -sf /etc/nginx/sites-available/zhinengxuanhao.cn.conf /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## 3️⃣ SSL 证书申请（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（会自动配置 Nginx）
sudo certbot --nginx -d zhinengxuanhao.cn -d www.zhinengxuanhao.cn

# 按提示输入邮箱并同意条款
```

---

## 4️⃣ 微信公众平台配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **开发** → **开发管理** → **开发设置**
3. 在 **服务器域名** 区域配置：

   - **request 合法域名**：`https://zhinengxuanhao.cn`
   - **uploadFile 合法域名**：`https://zhinengxuanhao.cn`（如需要）
   - **downloadFile 合法域名**：`https://zhinengxuanhao.cn`（如需要）

4. 点击 **保存并发布**

---

## 5️⃣ 验证配置

### 测试 API 服务
```bash
# 在服务器上测试
curl https://zhinengxuanhao.cn/health

# 应返回类似：{"status":"ok","timestamp":"..."}
```

### 验证 Nginx 状态
```bash
sudo systemctl status nginx
sudo nginx -t
```

---

## 📝 已完成的修改

### 前端配置文件
文件：`frontend/services/config.js`
```javascript
const API_CONFIG = {
  USE_REMOTE_API: true,
  API_BASE_URL: 'https://zhinengxuanhao.cn',
  // ...
};
```

---

## ⚠️ 注意事项

1. **SSL 证书续期**：Certbot 会自动配置定时续期任务
2. **防火墙**：确保服务器安全组开放 80 和 443 端口
3. **小程序发布**：配置完服务器域名后，需要重新上传小程序代码
