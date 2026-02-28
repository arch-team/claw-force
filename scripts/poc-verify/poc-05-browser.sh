#!/usr/bin/env bash
# ============================================================================
# poc-05-browser.sh — 浏览器自动化验证
# ============================================================================
# 验证项: Playwright/Chromium 可用性、网页浏览、截图、表单交互
# 前置条件: Docker 镜像构建时需启用 OPENCLAW_INSTALL_BROWSER=1
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
echo " PoC 验证 05 — 浏览器自动化"
echo "============================================"

if [[ ! -f "${EC2_PUBLIC_IP_FILE}" ]]; then
  echo "ERROR: 找不到 EC2 IP 文件" >&2
  exit 1
fi
EC2_IP=$(cat "${EC2_PUBLIC_IP_FILE}")
SSH_CMD="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@${EC2_IP}"

echo "目标: ${EC2_IP}"
echo ""

# ---------- 1. Chromium 安装检查 ----------
echo "[1/4] Chromium 安装检查..."
CHROMIUM_CHECK=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
# 检查 Docker 镜像中是否安装了 Chromium
BROWSER_PATH=$(docker compose exec openclaw-gateway find /home/node/.cache/ms-playwright -name "chromium" -type d 2>/dev/null | head -1)
if [[ -n "${BROWSER_PATH}" ]]; then
  echo "INSTALLED:${BROWSER_PATH}"
else
  # 也检查系统级安装
  SYSTEM_CHROMIUM=$(docker compose exec openclaw-gateway which chromium 2>/dev/null || \
                    docker compose exec openclaw-gateway which chromium-browser 2>/dev/null || echo "")
  if [[ -n "${SYSTEM_CHROMIUM}" ]]; then
    echo "INSTALLED:${SYSTEM_CHROMIUM}"
  else
    echo "NOT_INSTALLED"
  fi
fi
REMOTE
)
if [[ "${CHROMIUM_CHECK}" == INSTALLED:* ]]; then
  BROWSER_PATH="${CHROMIUM_CHECK#INSTALLED:}"
  log_result PASS "Chromium 安装" "已安装 (${BROWSER_PATH})"
else
  log_result FAIL "Chromium 未安装" "Docker 镜像未含浏览器（需 OPENCLAW_INSTALL_BROWSER=1 构建）"
  echo ""
  echo "  修复方法: 重新构建镜像"
  echo "  ssh -i ${SSH_KEY_PATH} ubuntu@${EC2_IP}"
  echo "  cd ~/openclaw && docker build --build-arg OPENCLAW_INSTALL_BROWSER=1 -t openclaw:local ."
  echo "  docker compose restart openclaw-gateway"
fi

# ---------- 2. Xvfb（虚拟显示器） ----------
echo "[2/4] Xvfb 虚拟显示器..."
XVFB_CHECK=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
XVFB=$(docker compose exec openclaw-gateway which Xvfb 2>/dev/null || echo "")
if [[ -n "${XVFB}" ]]; then
  echo "AVAILABLE:${XVFB}"
else
  echo "NOT_AVAILABLE"
fi
REMOTE
)
if [[ "${XVFB_CHECK}" == AVAILABLE:* ]]; then
  log_result PASS "Xvfb 虚拟显示器" "已安装"
else
  log_result SKIP "Xvfb 虚拟显示器" "未安装（headless 模式仍可运行）"
fi

# ---------- 3. Playwright 可用性 ----------
echo "[3/4] Playwright 运行时..."
PW_CHECK=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
# 检查 playwright-core 是否存在
PW_CLI=$(docker compose exec openclaw-gateway ls /app/node_modules/playwright-core/cli.js 2>/dev/null && echo "EXISTS" || echo "MISSING")
if [[ "${PW_CLI}" == "EXISTS" ]]; then
  # 获取版本
  PW_VERSION=$(docker compose exec openclaw-gateway node -e "console.log(require('playwright-core/package.json').version)" 2>/dev/null || echo "unknown")
  echo "AVAILABLE:${PW_VERSION}"
else
  echo "NOT_AVAILABLE"
fi
REMOTE
)
if [[ "${PW_CHECK}" == AVAILABLE:* ]]; then
  PW_VERSION="${PW_CHECK#AVAILABLE:}"
  log_result PASS "Playwright 运行时" "版本 ${PW_VERSION}"
else
  log_result FAIL "Playwright 运行时" "playwright-core 不可用"
fi

# ---------- 4. 浏览器工具可用性（Agent 层面） ----------
echo "[4/4] 浏览器工具（Agent 集成）..."
BROWSER_TOOL_CHECK=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
# 检查 OpenClaw 配置中的浏览器工具
TOOLS_CONFIG=$(docker compose run --rm openclaw-cli config get tools 2>&1 || echo "")
if echo "${TOOLS_CONFIG}" | grep -qi "browser\|playwright\|web\|navigate\|screenshot"; then
  echo "ENABLED"
else
  echo "CHECK_UI"
fi
REMOTE
)
if [[ "${BROWSER_TOOL_CHECK}" == *"ENABLED"* ]]; then
  log_result PASS "浏览器工具" "Agent 浏览器工具已启用"
else
  log_result SKIP "浏览器工具" "需通过 Control UI 手动验证（要求 Agent '访问 example.com 并截图'）"
fi

# ---------- 汇总 ----------
echo ""
echo "============================================"
echo " 浏览器自动化验证结果"
echo "============================================"
for result in "${RESULTS[@]}"; do
  echo -e "  ${result}"
done
echo ""
echo -e "  通过: ${GREEN}${PASS}${NC}  失败: ${RED}${FAIL}${NC}  跳过: ${YELLOW}${SKIP}${NC}"
echo ""
echo "手动深度验证指南:"
echo "  1. 通过 SSH Tunnel 访问 Control UI"
echo "  2. 发送: '请访问 https://example.com 并告诉我页面内容'"
echo "  3. 发送: '请对 https://news.ycombinator.com 截图'"
echo "  4. 发送: '请访问 https://httpbin.org/forms/post 并填写表单'"
echo "  5. 观察 Agent 是否能正确使用浏览器工具"
echo ""

REPORT_FILE="${SCRIPT_DIR}/results-05-browser.txt"
{
  echo "# PoC 验证 05 — 浏览器自动化"
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
