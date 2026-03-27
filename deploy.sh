#!/usr/bin/env bash
# ============================================================
# deploy.sh — 阿里云 ECS 一键部署脚本
# 使用方式：
#   chmod +x deploy.sh
#   ./deploy.sh
#
# 支持：
#   - 首次部署（自动安装 Docker + 构建 + 启动）
#   - 更新部署（git pull + 重新构建 + 热重启）
#   - 可选：申请 Let's Encrypt SSL 证书
# ============================================================
set -e

# ── 颜色输出 ─────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warning() { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   SLE + APS 健康管理系统 - 云端部署          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. 安装 Docker ────────────────────────────────────────────
install_docker() {
    info "检测 Docker..."
    if command -v docker &>/dev/null && docker compose version &>/dev/null; then
        success "Docker 已安装: $(docker --version)"
        return
    fi

    info "安装 Docker..."
    # 检测操作系统
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    fi

    case "$OS" in
        ubuntu|debian)
            apt-get update -q
            apt-get install -y -q ca-certificates curl gnupg lsb-release
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
                https://download.docker.com/linux/$OS $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
            apt-get update -q
            apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
            ;;
        centos|rhel|aliyun|alinux)
            yum install -y yum-utils
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
            systemctl enable --now docker
            ;;
        *)
            error "不支持的操作系统: $OS，请手动安装 Docker"
            ;;
    esac

    systemctl enable --now docker 2>/dev/null || true
    success "Docker 安装完成"
}

# ── 2. 初始化配置 ─────────────────────────────────────────────
init_config() {
    info "检查配置..."

    # 生成随机 Token（首次部署）
    CONFIG_FILE="$SCRIPT_DIR/backend/config.yaml"
    CURRENT_TOKEN=$(python3 -c "
import yaml
with open('$CONFIG_FILE') as f:
    cfg = yaml.safe_load(f)
print(cfg.get('auth', {}).get('access_token', 'change-me-to-a-secret'))
" 2>/dev/null || echo "change-me-to-a-secret")

    if [ "$CURRENT_TOKEN" = "change-me-to-a-secret" ] || [ -z "$CURRENT_TOKEN" ]; then
        NEW_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
        python3 -c "
import yaml, re
with open('$CONFIG_FILE', 'r') as f:
    content = f.read()
content = re.sub(
    r'(access_token:\s*)\"[^\"]*\"',
    f'access_token: \"$NEW_TOKEN\"',
    content
)
with open('$CONFIG_FILE', 'w') as f:
    f.write(content)
print('Token 已生成')
"
        echo ""
        echo "┌──────────────────────────────────────────────────────┐"
        echo "│  🔑 首次部署：已自动生成访问密钥                     │"
        echo "│                                                      │"
        echo "│  ACCESS TOKEN: $NEW_TOKEN  │"
        echo "│                                                      │"
        echo "│  ⚠️  请保存此 Token，登录时需要输入                   │"
        echo "└──────────────────────────────────────────────────────┘"
        echo ""
        ACCESS_TOKEN="$NEW_TOKEN"
    else
        success "配置文件已存在，Token 已配置"
        ACCESS_TOKEN="$CURRENT_TOKEN"
    fi

    # 确保数据目录存在
    mkdir -p data/uploads data/certbot/conf data/certbot/www
}

# ── 3. 构建并启动 ─────────────────────────────────────────────
build_and_start() {
    info "构建 Docker 镜像（首次较慢，约 2-5 分钟）..."
    docker compose build --no-cache

    info "启动服务..."
    docker compose up -d

    # 等待后端健康检查通过
    info "等待服务启动..."
    for i in $(seq 1 30); do
        if docker compose exec backend curl -sf http://localhost:8000/api/health &>/dev/null; then
            success "后端服务已就绪"
            break
        fi
        sleep 2
        if [ $i -eq 30 ]; then
            warning "后端启动超时，请运行: docker compose logs backend"
        fi
    done
}

# ── 4. 可选：申请 SSL 证书 ────────────────────────────────────
setup_ssl() {
    echo ""
    echo "─────────────────────────────────────────────"
    read -p "是否配置 HTTPS？需要已解析好的域名 [y/N]: " setup_ssl_answer
    if [[ "$setup_ssl_answer" != "y" && "$setup_ssl_answer" != "Y" ]]; then
        info "跳过 HTTPS 配置，HTTP 模式运行"
        return
    fi

    read -p "请输入您的域名（如 health.example.com）: " DOMAIN
    read -p "请输入您的邮箱（Let's Encrypt 通知用）: " EMAIL

    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        warning "域名或邮箱为空，跳过 SSL 配置"
        return
    fi

    info "申请 Let's Encrypt SSL 证书..."

    # 确保 80 端口临时可访问（用于 webroot 验证）
    docker compose up -d frontend

    # 申请证书
    docker run --rm \
        -v "$SCRIPT_DIR/data/certbot/conf:/etc/letsencrypt" \
        -v "$SCRIPT_DIR/data/certbot/www:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot -w /var/www/certbot \
        -d "$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos --no-eff-email \
        || { warning "证书申请失败，请检查域名 DNS 是否已解析到本机 IP"; return; }

    # 生成 HTTPS Nginx 配置
    cat > "$SCRIPT_DIR/nginx/nginx.conf" <<EOF
# HTTP → 跳转 HTTPS
server {
    listen 80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS 主服务
server {
    listen 443 ssl;
    server_name ${DOMAIN};
    http2 on;

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host             \$host;
        proxy_set_header   X-Real-IP        \$remote_addr;
        proxy_set_header   X-Forwarded-For  \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        client_max_body_size 30m;
    }

    location /uploads/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
    }

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

    # 重启 Nginx 加载 HTTPS 配置
    docker compose restart frontend

    success "HTTPS 配置完成！"
    echo ""
    echo "  🌐 访问地址：https://${DOMAIN}"
    echo "  🔑 访问密钥：${ACCESS_TOKEN}"
    echo ""

    # 设置证书自动续期（crontab）
    CRON_JOB="0 3 * * * docker run --rm -v $SCRIPT_DIR/data/certbot/conf:/etc/letsencrypt -v $SCRIPT_DIR/data/certbot/www:/var/www/certbot certbot/certbot renew --quiet && docker compose -f $SCRIPT_DIR/docker-compose.yml restart frontend"
    (crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | crontab -
    success "已设置证书每日自动续期"
}

# ── 5. 打印总结 ───────────────────────────────────────────────
print_summary() {
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  🎉 部署完成！                                           ║"
    echo "╠══════════════════════════════════════════════════════════╣"
    echo "║                                                          ║"
    printf "║  HTTP 访问：http://%-38s ║\n" "${SERVER_IP}"
    echo "║                                                          ║"
    printf "║  访问密钥：%-42s ║\n" "${ACCESS_TOKEN:0:40}"
    echo "║                                                          ║"
    echo "║  常用命令：                                              ║"
    echo "║    查看日志：  docker compose logs -f                    ║"
    echo "║    停止服务：  docker compose down                       ║"
    echo "║    更新重启：  git pull && ./deploy.sh                   ║"
    echo "║    备份数据：  cp -r data/ data_backup_$(date +%Y%m%d)/         ║"
    echo "║                                                          ║"
    echo "║  阿里云安全组需放行端口：80, 443                         ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
}

# ── 主流程 ────────────────────────────────────────────────────
main() {
    # 检查是否 root 权限（Docker 安装需要）
    if [ "$EUID" -ne 0 ] && ! command -v docker &>/dev/null; then
        warning "安装 Docker 需要 root 权限，请使用 sudo ./deploy.sh"
        exit 1
    fi

    install_docker
    init_config
    build_and_start
    setup_ssl
    print_summary
}

main "$@"
