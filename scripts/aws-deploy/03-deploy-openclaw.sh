#!/usr/bin/env bash
# ============================================================================
# 03-deploy-openclaw.sh — 部署 OpenClaw 到 EC2（SSH 远程执行）
# ============================================================================
# 安全最佳实践:
#   - Gateway Token 使用 openssl 自动生成（64 字符 hex）
#   - 不传输任何 API Key 到服务器（使用 IAM Role）
#   - .env 文件权限设为 600
#   - Docker 以非 root 用户运行
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.env"

# 项目根目录
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OPENCLAW_SRC="${PROJECT_ROOT}/openclaw-fork"

echo "============================================"
echo " Deploy OpenClaw — EC2 远程部署"
echo "============================================"

# ---------- 读取实例信息 ----------
if [[ ! -f "${EC2_PUBLIC_IP_FILE}" ]]; then
  echo "ERROR: 找不到 EC2 IP 文件。请先运行 02-ec2-launch.sh" >&2
  exit 1
fi
EC2_IP=$(cat "${EC2_PUBLIC_IP_FILE}")
echo "目标实例: ubuntu@${EC2_IP}"

SSH_CMD="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@${EC2_IP}"

# ---------- 等待 User Data 完成 ----------
echo ""
echo "[1/5] 等待 EC2 初始化完成（Docker 安装）..."
RETRIES=0
MAX_RETRIES=30
while ! ${SSH_CMD} "test -f /tmp/openclaw-userdata-done" 2>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [[ ${RETRIES} -ge ${MAX_RETRIES} ]]; then
    echo "ERROR: User Data 执行超时（${MAX_RETRIES}0s）。请检查:" >&2
    echo "  ${SSH_CMD} 'cat /var/log/openclaw-userdata.log'" >&2
    exit 1
  fi
  echo "  等待中... (${RETRIES}/${MAX_RETRIES})"
  sleep 10
done
echo "  Docker 安装完成"

# ---------- 同步代码 ----------
echo ""
echo "[2/5] 同步 OpenClaw 代码到 EC2..."

if [[ "${DEPLOY_METHOD}" == "rsync" ]]; then
  if [[ ! -d "${OPENCLAW_SRC}" ]]; then
    echo "ERROR: 未找到 openclaw-fork 目录: ${OPENCLAW_SRC}" >&2
    exit 1
  fi
  rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude '.env' \
    -e "ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=accept-new" \
    "${OPENCLAW_SRC}/" \
    "ubuntu@${EC2_IP}:~/openclaw/"
  echo "  代码同步完成"
elif [[ "${DEPLOY_METHOD}" == "git" ]]; then
  if [[ -z "${OPENCLAW_REPO_URL}" ]]; then
    echo "ERROR: DEPLOY_METHOD=git 但 OPENCLAW_REPO_URL 未设置" >&2
    exit 1
  fi
  ${SSH_CMD} "git clone '${OPENCLAW_REPO_URL}' ~/openclaw || (cd ~/openclaw && git pull)"
  echo "  代码克隆/更新完成"
else
  echo "ERROR: 未知的 DEPLOY_METHOD: ${DEPLOY_METHOD}" >&2
  exit 1
fi

# ---------- 构建 Docker 镜像 ----------
echo ""
echo "[3/5] 构建 Docker 镜像..."

BUILD_ARGS=""
if [[ "${INSTALL_BROWSER}" == "1" ]]; then
  BUILD_ARGS="--build-arg OPENCLAW_INSTALL_BROWSER=1"
  echo "  含浏览器自动化支持（Chromium，+300MB，构建较慢）"
fi

${SSH_CMD} "cd ~/openclaw && docker build ${BUILD_ARGS} -t openclaw:local -f Dockerfile ."
echo "  镜像构建完成"

# ---------- 配置环境变量 ----------
echo ""
echo "[4/5] 配置环境变量..."

# 安全: 在远端生成 Gateway Token（不通过网络传输）
${SSH_CMD} bash <<'REMOTE_ENV'
set -euo pipefail

cd ~/openclaw

# 创建数据目录
mkdir -p ~/.openclaw ~/.openclaw/workspace ~/.openclaw/identity

# 生成 Gateway Token（如果尚未生成）
if [[ ! -f ~/.openclaw/.gateway-token ]]; then
  GATEWAY_TOKEN=$(openssl rand -hex 32)
  echo "${GATEWAY_TOKEN}" > ~/.openclaw/.gateway-token
  chmod 600 ~/.openclaw/.gateway-token
  echo "  Gateway Token 已生成并保存"
else
  GATEWAY_TOKEN=$(cat ~/.openclaw/.gateway-token)
  echo "  复用已有 Gateway Token"
fi

# 创建 .env 文件（最小配置，无 API Key）
cat > .env <<EOF
OPENCLAW_CONFIG_DIR=${HOME}/.openclaw
OPENCLAW_WORKSPACE_DIR=${HOME}/.openclaw/workspace
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_BRIDGE_PORT=18790
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_TOKEN=${GATEWAY_TOKEN}
OPENCLAW_IMAGE=openclaw:local
OPENCLAW_EXTRA_MOUNTS=
OPENCLAW_HOME_VOLUME=
OPENCLAW_DOCKER_APT_PACKAGES=
EOF
chmod 600 .env
echo "  .env 已创建（权限: 600）"
REMOTE_ENV

# ---------- 启动 Gateway ----------
echo ""
echo "[5/5] 启动 OpenClaw Gateway..."

${SSH_CMD} bash <<'REMOTE_START'
set -euo pipefail
cd ~/openclaw

# 设置 NODE_OPTIONS
export NODE_OPTIONS="--max-old-space-size=2048"

# 启动 Gateway
docker compose up -d openclaw-gateway

# 等待健康检查（最多 60s）
echo "  等待 Gateway 就绪..."
RETRIES=0
while [[ ${RETRIES} -lt 12 ]]; do
  if docker compose exec openclaw-gateway node dist/index.js health --token "$(cat ~/.openclaw/.gateway-token)" 2>/dev/null; then
    echo "  Gateway 健康检查通过"
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 5
done

if [[ ${RETRIES} -ge 12 ]]; then
  echo "WARNING: 健康检查超时，查看日志:"
  docker compose logs --tail 50 openclaw-gateway
fi

# 显示容器状态
docker compose ps
REMOTE_START

# 读取 Gateway Token
GATEWAY_TOKEN=$(${SSH_CMD} "cat ~/.openclaw/.gateway-token")

echo ""
echo "============================================"
echo " OpenClaw 部署完成"
echo "============================================"
echo "  实例:    ubuntu@${EC2_IP}"
echo "  Gateway: http://${EC2_IP}:${OPENCLAW_GATEWAY_PORT}"
echo "  Bridge:  http://${EC2_IP}:${OPENCLAW_BRIDGE_PORT}"
echo "  Token:   ${GATEWAY_TOKEN}"
echo ""
echo "安全提醒:"
echo "  - Gateway Token 已在远端生成，未经网络明文传输生成过程"
echo "  - .env 文件权限为 600"
echo "  - 无 API Key 硬编码（使用 IAM Role 访问 Bedrock）"
echo "  - Docker 容器以 node 用户运行（非 root）"
echo ""
echo "SSH Tunnel（推荐的安全访问方式）:"
echo "  ssh -i ${SSH_KEY_PATH} -L 18789:localhost:18789 -L 18790:localhost:18790 ubuntu@${EC2_IP}"
echo "  然后浏览器访问: http://localhost:18789"
echo ""
echo "下一步: bash 04-configure-bedrock.sh"
