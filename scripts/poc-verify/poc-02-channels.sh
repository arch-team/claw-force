#!/usr/bin/env bash
# ============================================================================
# poc-02-channels.sh — 消息渠道验证
# ============================================================================
# 验证项: WebChat、Telegram、Slack、Discord
# 需要对应平台的 Bot Token（未配置的渠道标记为 SKIP）
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${SCRIPT_DIR}/../aws-deploy"
source "${DEPLOY_DIR}/config.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0
RESULTS=()

log_result() {
  local status="$1" name="$2" detail="${3:-}"
  case "${status}" in
    PASS) PASS=$((PASS + 1)); RESULTS+=("${GREEN}[PASS]${NC} ${name}: ${detail}") ;;
    FAIL) FAIL=$((FAIL + 1)); RESULTS+=("${RED}[FAIL]${NC} ${name}: ${detail}") ;;
    SKIP) SKIP=$((SKIP + 1)); RESULTS+=("${YELLOW}[SKIP]${NC} ${name}: ${detail}") ;;
  esac
}

echo "============================================"
echo " PoC 验证 02 — 消息渠道"
echo "============================================"

if [[ ! -f "${EC2_PUBLIC_IP_FILE}" ]]; then
  echo "ERROR: 找不到 EC2 IP 文件" >&2
  exit 1
fi
EC2_IP=$(cat "${EC2_PUBLIC_IP_FILE}")
SSH_CMD="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@${EC2_IP}"

echo "目标: ${EC2_IP}"
echo ""

# ---------- 1. WebChat（内置） ----------
echo "[1/4] WebChat（内置渠道）..."
# WebChat 是内置功能，通过 Control UI 的 WebSocket 实现
GATEWAY_URL="http://${EC2_IP}:${OPENCLAW_GATEWAY_PORT}"
WS_CHECK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${GATEWAY_URL}" 2>/dev/null || echo "000")
if [[ "${WS_CHECK}" == "200" || "${WS_CHECK}" == "101" || "${WS_CHECK}" == "302" ]]; then
  log_result PASS "WebChat" "Control UI 可达 (HTTP ${WS_CHECK})，WebChat 内置可用"
else
  log_result FAIL "WebChat" "Control UI 不可达 (HTTP ${WS_CHECK})"
fi

# ---------- 2. Telegram ----------
echo "[2/4] Telegram..."
TELEGRAM_STATUS=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
# 检查是否配置了 Telegram
TG_CONFIG=$(docker compose run --rm openclaw-cli channels status 2>&1 || echo "")
if echo "${TG_CONFIG}" | grep -qi "telegram.*connected\|telegram.*online"; then
  echo "CONNECTED"
elif echo "${TG_CONFIG}" | grep -qi "telegram"; then
  echo "CONFIGURED"
else
  echo "NOT_CONFIGURED"
fi
REMOTE
)
case "${TELEGRAM_STATUS}" in
  *CONNECTED*) log_result PASS "Telegram" "已连接" ;;
  *CONFIGURED*) log_result PASS "Telegram" "已配置（需验证消息收发）" ;;
  *) log_result SKIP "Telegram" "未配置 Bot Token（可通过 'openclaw channels add --channel telegram --token <token>' 配置）" ;;
esac

# ---------- 3. Slack ----------
echo "[3/4] Slack..."
SLACK_STATUS=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
SLACK_CONFIG=$(docker compose run --rm openclaw-cli channels status 2>&1 || echo "")
if echo "${SLACK_CONFIG}" | grep -qi "slack.*connected\|slack.*online"; then
  echo "CONNECTED"
elif echo "${SLACK_CONFIG}" | grep -qi "slack"; then
  echo "CONFIGURED"
else
  echo "NOT_CONFIGURED"
fi
REMOTE
)
case "${SLACK_STATUS}" in
  *CONNECTED*) log_result PASS "Slack" "已连接" ;;
  *CONFIGURED*) log_result PASS "Slack" "已配置（需验证消息收发）" ;;
  *) log_result SKIP "Slack" "未配置 Bot Token（需要 SLACK_BOT_TOKEN + SLACK_APP_TOKEN）" ;;
esac

# ---------- 4. Discord ----------
echo "[4/4] Discord..."
DISCORD_STATUS=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
DISCORD_CONFIG=$(docker compose run --rm openclaw-cli channels status 2>&1 || echo "")
if echo "${DISCORD_CONFIG}" | grep -qi "discord.*connected\|discord.*online"; then
  echo "CONNECTED"
elif echo "${DISCORD_CONFIG}" | grep -qi "discord"; then
  echo "CONFIGURED"
else
  echo "NOT_CONFIGURED"
fi
REMOTE
)
case "${DISCORD_STATUS}" in
  *CONNECTED*) log_result PASS "Discord" "已连接" ;;
  *CONFIGURED*) log_result PASS "Discord" "已配置（需验证消息收发）" ;;
  *) log_result SKIP "Discord" "未配置 Bot Token（可通过 'openclaw channels add --channel discord --token <token>' 配置）" ;;
esac

# ---------- 汇总 ----------
echo ""
echo "============================================"
echo " 消息渠道验证结果"
echo "============================================"
for result in "${RESULTS[@]}"; do
  echo -e "  ${result}"
done
echo ""
echo -e "  通过: ${GREEN}${PASS}${NC}  失败: ${RED}${FAIL}${NC}  跳过: ${YELLOW}${SKIP}${NC}"
echo ""
echo "手动验证指南（通过 SSH Tunnel 访问 Control UI）:"
echo "  1. ssh -i ${SSH_KEY_PATH} -L 18789:localhost:18789 ubuntu@${EC2_IP}"
echo "  2. 浏览器打开 http://localhost:18789"
echo "  3. 在 WebChat 中发送消息验证 AI 回复"
echo ""

REPORT_FILE="${SCRIPT_DIR}/results-02-channels.txt"
{
  echo "# PoC 验证 02 — 消息渠道"
  echo "# 时间: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "# 实例: ${EC2_IP}"
  echo ""
  for result in "${RESULTS[@]}"; do
    echo -e "${result}" | sed 's/\x1B\[[0-9;]*m//g'
  done
  echo ""
  echo "通过: ${PASS}  失败: ${FAIL}  跳过: ${SKIP}"
} > "${REPORT_FILE}"
echo "结果已保存: ${REPORT_FILE}"
