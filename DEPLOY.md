# 阿里云部署操作手册

> SLE 健康管理系统 — 从零到生产环境完整操作步骤

---

## 目录

1. [准备工作](#1-准备工作)
2. [服务器初始化](#2-服务器初始化)
3. [部署应用](#3-部署应用)
4. [DNS 解析配置](#4-dns-解析配置)
5. [HTTPS / SSL 证书](#5-https--ssl-证书)
6. [AI 解析配置（通义千问）](#6-ai-解析配置通义千问)
7. [访问与登录](#7-访问与登录)
8. [日常维护命令](#8-日常维护命令)
9. [数据备份与迁移](#9-数据备份与迁移)
10. [常见问题排查](#10-常见问题排查)

---

## 1. 准备工作

### 1.1 阿里云 ECS 规格推荐

| 配置 | 说明 |
|------|------|
| 操作系统 | Ubuntu 22.04 LTS（推荐）或 Alibaba Cloud Linux 3 |
| CPU | 1 核（最低），2 核（推荐） |
| 内存 | 2 GB（最低），4 GB（推荐，用于 Docker 镜像构建） |
| 磁盘 | 40 GB SSD |
| 网络 | 固定公网 IP 或弹性 IP（EIP） |
| 带宽 | 1 Mbps 起（个人使用足够） |

### 1.2 安全组规则（必须提前配置）

在阿里云 ECS 控制台 → 安全组 → 入方向，添加以下规则：

| 端口 | 协议 | 来源 | 说明 |
|------|------|------|------|
| 80 | TCP | 0.0.0.0/0 | HTTP（也用于 SSL 验证） |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| 22 | TCP | 你的 IP | SSH（建议限制来源 IP） |

> ⚠️ **不需要**开放 8000 端口，后端只被 Nginx 内部访问。

### 1.3 域名（可选，HTTPS 需要）

- 在阿里云域名控制台购买或管理域名
- 准备一个子域名，如 `health.yourdomain.com`

---

## 2. 服务器初始化

### 2.1 SSH 登录服务器

```bash
ssh root@<ECS公网IP>
# 或使用 SSH 密钥
ssh -i ~/.ssh/your-key.pem root@<ECS公网IP>
```

### 2.2 系统更新

```bash
apt-get update && apt-get upgrade -y
# 安装基本工具
apt-get install -y git curl wget vim
```

### 2.3 克隆项目代码

```bash
cd /opt
git clone https://github.com/liuyufei05/health-manager.git
cd health-manager
```

---

## 3. 部署应用

### 3.1 一键部署（推荐）

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

脚本执行流程：
1. ✅ 检测并安装 Docker + Docker Compose
2. ✅ 自动生成随机访问密钥（**记录打印出的 TOKEN**）
3. ✅ 构建 Docker 镜像（首次约 3-5 分钟）
4. ✅ 启动后端 + 前端容器
5. ✅ 可选：申请 Let's Encrypt SSL 证书

### 3.2 手动部署步骤（如果自动脚本失败）

**步骤 1：安装 Docker**
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

**步骤 2：修改访问密钥**
```bash
# 生成随机密钥
TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "你的访问密钥: $TOKEN"

# 写入配置文件
sed -i "s/change-me-to-a-secret/$TOKEN/" backend/config.yaml
```

**步骤 3：启用认证**
```bash
# 编辑 config.yaml，将 auth.enabled 改为 true
vim backend/config.yaml
# 找到 enabled: false 改为 enabled: true
```

**步骤 4：构建并启动**
```bash
docker compose build
docker compose up -d
```

**步骤 5：验证启动成功**
```bash
docker compose ps
# 应看到 hm-backend 和 hm-frontend 都是 Up 状态

curl http://localhost/api/health
# 应返回 {"status":"ok",...}
```

---

## 4. DNS 解析配置

### 4.1 获取服务器 IP

```bash
curl -s ifconfig.me
# 或
hostname -I | awk '{print $1}'
```

### 4.2 在阿里云 DNS 控制台添加解析

1. 登录 [阿里云 DNS 控制台](https://dns.console.aliyun.com/)
2. 选择你的域名 → 添加记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
|--------|---------|--------|-----|
| A | health | `<ECS公网IP>` | 10 分钟 |

3. 保存后等待 DNS 生效（通常 5-10 分钟）

### 4.3 验证 DNS 生效

```bash
# 在本地终端执行
ping health.yourdomain.com
# 或
nslookup health.yourdomain.com
```

---

## 5. HTTPS / SSL 证书

> DNS 解析生效后再执行此步骤

### 5.1 申请证书（Let's Encrypt 免费证书）

```bash
cd /opt/health-manager

# 申请证书
docker run --rm \
  -v $(pwd)/data/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/data/certbot/www:/var/www/certbot \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  -d health.yourdomain.com \
  --email your@email.com \
  --agree-tos --no-eff-email
```

### 5.2 配置 HTTPS Nginx

编辑 `nginx/nginx.conf`，将内容替换为 HTTPS 配置：

```bash
cat > nginx/nginx.conf << 'EOF'
# HTTP → 跳转 HTTPS
server {
    listen 80;
    server_name health.yourdomain.com;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS 主服务
server {
    listen 443 ssl;
    server_name health.yourdomain.com;
    http2 on;

    ssl_certificate     /etc/letsencrypt/live/health.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/health.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host             $host;
        proxy_set_header   X-Real-IP        $remote_addr;
        proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 30m;
    }

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options SAMEORIGIN;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF
```

### 5.3 重启 Nginx 使配置生效

```bash
docker compose restart frontend
```

### 5.4 设置证书自动续期

```bash
# 添加 cron 任务（每天凌晨 3 点检查续期）
(crontab -l 2>/dev/null; echo "0 3 * * * cd /opt/health-manager && docker run --rm \
  -v \$(pwd)/data/certbot/conf:/etc/letsencrypt \
  -v \$(pwd)/data/certbot/www:/var/www/certbot \
  certbot/certbot renew --quiet && docker compose restart frontend") | crontab -

# 验证 cron 已添加
crontab -l
```

---

## 6. AI 解析配置（通义千问）

### 6.1 获取通义千问 API Key

1. 登录 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 左侧菜单 → API-KEY 管理 → 创建 API Key
3. 复制 `sk-xxxxxxxx...` 格式的 Key

### 6.2 配置系统使用通义千问 Vision 模式

方式一：**在系统设置页配置（推荐）**
1. 登录系统 → 设置 → 解析配置
2. 图片解析部分：
   - Provider: `openai`（通义千问兼容 OpenAI 接口）
   - Model: `qwen-vl-plus`（视觉理解模型）
   - API Key: `sk-你的密钥`
   - Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - **Use Vision**: ✅ 开启（直接让模型看图，无需 OCR）
3. 点击保存

方式二：**直接编辑 config.yaml**
```bash
vim /opt/health-manager/backend/config.yaml
```

修改 `parse.image` 部分：
```yaml
parse:
  image:
    provider: openai
    model: qwen-vl-plus          # 或 qwen-vl-max（更准确，费用更高）
    api_key: "sk-你的DashScope密钥"
    base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
    use_vision: true             # 关键！直接视觉识图，跳过 OCR
    timeout: 60
```

修改后重启后端生效：
```bash
docker compose restart backend
```

### 6.3 通义千问模型选择

| 模型 | 说明 | 费用 |
|------|------|------|
| `qwen-vl-plus` | 视觉理解，识别化验单准确率高 | 约 0.008元/千tokens |
| `qwen-vl-max` | 最强视觉，处理复杂表格更准确 | 约 0.04元/千tokens |
| `qwen2.5-vl-7b-instruct` | 可本地部署 | 免费（需 GPU） |

> 一张化验单图片通常消耗 500-2000 tokens，费用约 0.004-0.016 元。

### 6.4 费用控制

在 DashScope 控制台可设置：
- **费用预警**：超过阈值发短信通知
- **额度限制**：设置每月最高消费额度

---

## 7. 访问与登录

### 7.1 访问地址

- 有域名：`https://health.yourdomain.com`
- 无域名：`http://<ECS公网IP>`

### 7.2 查看访问密钥

```bash
cd /opt/health-manager
python3 -c "
import yaml
with open('backend/config.yaml') as f:
    cfg = yaml.safe_load(f)
print('访问密钥:', cfg['auth']['access_token'])
"
```

### 7.3 修改访问密钥

```bash
# 生成新密钥
NEW_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "新密钥: $NEW_TOKEN"

# 更新配置
python3 -c "
import yaml, re
with open('backend/config.yaml') as f:
    content = f.read()
content = re.sub(r'(access_token:\s*)\"[^\"]*\"', f'access_token: \"$NEW_TOKEN\"', content)
with open('backend/config.yaml', 'w') as f:
    f.write(content)
print('密钥已更新')
"

# 重启后端
docker compose restart backend
```

---

## 8. 日常维护命令

### 查看服务状态
```bash
cd /opt/health-manager
docker compose ps
```

### 查看实时日志
```bash
# 全部服务
docker compose logs -f

# 仅后端
docker compose logs -f backend

# 仅前端/Nginx
docker compose logs -f frontend
```

### 重启服务
```bash
# 重启全部
docker compose restart

# 仅重启后端（修改 config.yaml 后）
docker compose restart backend

# 仅重启前端/Nginx（修改 nginx.conf 后）
docker compose restart frontend
```

### 更新代码并重新部署
```bash
cd /opt/health-manager
git pull

# 重新构建并重启（保留数据）
docker compose build
docker compose up -d
```

### 停止服务
```bash
docker compose down
```

### 查看资源占用
```bash
docker stats
```

---

## 9. 数据备份与迁移

### 9.1 备份数据

所有数据存储在 `data/` 目录：
- `data/health.db` — SQLite 数据库（所有指标/症状/用药记录）
- `data/uploads/` — 上传的化验单文件
- `backend/config.yaml` — 配置文件（含密钥）

```bash
# 创建带日期的备份
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
cd /opt
tar -czf health-manager-backup-$BACKUP_DATE.tar.gz \
  health-manager/data/ \
  health-manager/backend/config.yaml

echo "备份文件: health-manager-backup-$BACKUP_DATE.tar.gz"
```

### 9.2 下载备份到本地（在本地终端执行）

```bash
scp root@<ECS公网IP>:/opt/health-manager-backup-*.tar.gz ~/Desktop/
```

### 9.3 迁移到新服务器

```bash
# 在新服务器上
cd /opt
git clone https://github.com/liuyufei05/health-manager.git
cd health-manager

# 恢复数据
tar -xzf /path/to/health-manager-backup-XXXXXXXX.tar.gz

# 启动
docker compose up -d
```

---

## 10. 常见问题排查

### 问题 1：服务启动后无法访问

```bash
# 检查容器是否运行
docker compose ps

# 检查端口是否监听
ss -tlnp | grep -E '80|443|8000'

# 检查阿里云安全组是否放行 80/443
# → 阿里云控制台 → ECS → 安全组 → 入方向规则
```

### 问题 2：AI 解析失败

```bash
# 查看后端日志
docker compose logs backend | grep -i "error\|vision\|parse"

# 验证通义千问 API Key 是否有效
curl -X POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions \
  -H "Authorization: Bearer sk-你的密钥" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-vl-plus","messages":[{"role":"user","content":"hello"}]}'
```

### 问题 3：上传文件后解析卡住

```bash
# 检查后端是否响应
curl http://localhost:8000/api/health

# 检查解析超时（增大 timeout）
vim backend/config.yaml
# 修改 parse.image.timeout: 120
docker compose restart backend
```

### 问题 4：SSL 证书申请失败

常见原因：
1. **DNS 未生效**：等待 5-10 分钟或 `nslookup 你的域名` 验证
2. **80 端口被占用**：`ss -tlnp | grep 80` 检查
3. **安全组未放行 80**：在阿里云控制台检查安全组规则

### 问题 5：磁盘空间不足

```bash
# 查看磁盘使用
df -h

# 清理 Docker 无用镜像
docker system prune -f

# 查看 data 目录大小
du -sh /opt/health-manager/data/
du -sh /opt/health-manager/data/uploads/
```

---

## 版本信息

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-03-27 | 初版，Docker 部署 + Token 认证 + 通义千问 Vision |
