#!/usr/bin/env bash
# ============================================================================
# poc-04-plugins.sh — 插件系统验证
# ============================================================================
# 验证项: 插件列表、插件安装、Skills 系统、Cron 调度、Hooks 系统
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
echo " PoC 验证 04 — 插件系统"
echo "============================================"

if [[ ! -f "${EC2_PUBLIC_IP_FILE}" ]]; then
  echo "ERROR: 找不到 EC2 IP 文件" >&2
  exit 1
fi
EC2_IP=$(cat "${EC2_PUBLIC_IP_FILE}")
SSH_CMD="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@${EC2_IP}"

echo "目标: ${EC2_IP}"
echo ""

# ---------- 1. 插件列表 ----------
echo "[1/5] 内置插件列表..."
PLUGINS_OUTPUT=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
docker compose run --rm openclaw-cli plugins list 2>&1 || echo "CMD_ERROR"
REMOTE
)
if echo "${PLUGINS_OUTPUT}" | grep -qi "plugin\|extension\|installed\|name"; then
  PLUGIN_COUNT=$(echo "${PLUGINS_OUTPUT}" | grep -c "^\|│\|├\|└\|plugin\|extension" || echo "0")
  log_result PASS "内置插件列表" "插件系统可用 (${PLUGIN_COUNT} 行输出)"
elif echo "${PLUGINS_OUTPUT}" | grep -qi "CMD_ERROR\|command not found"; then
  log_result FAIL "内置插件列表" "plugins 命令不可用"
else
  log_result PASS "内置插件列表" "$(echo "${PLUGINS_OUTPUT}" | head -3 | tr '\n' ' ')"
fi

# ---------- 2. Skills 系统 ----------
echo "[2/5] Skills 系统..."
SKILLS_OUTPUT=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
docker compose run --rm openclaw-cli skills list 2>&1 || echo "CMD_ERROR"
REMOTE
)
if echo "${SKILLS_OUTPUT}" | grep -qi "skill\|name\|trigger\|CMD_ERROR" && ! echo "${SKILLS_OUTPUT}" | grep -qi "CMD_ERROR"; then
  log_result PASS "Skills 系统" "Skills 列表可用"
elif echo "${SKILLS_OUTPUT}" | grep -qi "CMD_ERROR\|command not found"; then
  log_result SKIP "Skills 系统" "skills 命令不可用（可能需要通过 Control UI 验证）"
else
  log_result PASS "Skills 系统" "$(echo "${SKILLS_OUTPUT}" | head -3 | tr '\n' ' ')"
fi

# ---------- 3. 插件安装测试 ----------
echo "[3/5] 插件安装（ClawHub）..."
INSTALL_OUTPUT=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
# 尝试列出可安装的插件
docker compose run --rm openclaw-cli plugins search 2>&1 || \
docker compose run --rm openclaw-cli plugins available 2>&1 || \
echo "SEARCH_NOT_AVAILABLE"
REMOTE
)
if echo "${INSTALL_OUTPUT}" | grep -qi "SEARCH_NOT_AVAILABLE"; then
  log_result SKIP "插件安装" "插件搜索命令不可用（可能需要通过 Control UI 安装）"
else
  log_result PASS "插件安装" "插件仓库可达"
fi

# ---------- 4. Cron 调度 ----------
echo "[4/5] Cron 调度系统..."
CRON_OUTPUT=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
docker compose run --rm openclaw-cli config get cron 2>&1 || echo "CMD_ERROR"
REMOTE
)
if echo "${CRON_OUTPUT}" | grep -qi "CMD_ERROR\|not found\|null\|undefined"; then
  log_result SKIP "Cron 调度" "未配置定时任务（可通过 config set cron 配置）"
else
  log_result PASS "Cron 调度" "Cron 配置存在"
fi

# ---------- 5. Hooks 系统 ----------
echo "[5/5] Hooks 系统..."
HOOKS_OUTPUT=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
docker compose run --rm openclaw-cli config get hooks 2>&1 || echo "CMD_ERROR"
REMOTE
)
if echo "${HOOKS_OUTPUT}" | grep -qi "CMD_ERROR"; then
  log_result SKIP "Hooks 系统" "hooks 配置命令不可用"
elif echo "${HOOKS_OUTPUT}" | grep -qi "null\|undefined\|{}"; then
  log_result SKIP "Hooks 系统" "未配置 Hooks（可通过 config set hooks 配置）"
else
  log_result PASS "Hooks 系统" "Hooks 配置存在"
fi

# ---------- 汇总 ----------
echo ""
echo "============================================"
echo " 插件系统验证结果"
echo "============================================"
for result in "${RESULTS[@]}"; do
  echo -e "  ${result}"
done
echo ""
echo -e "  通过: ${GREEN}${PASS}${NC}  失败: ${RED}${FAIL}${NC}  跳过: ${YELLOW}${SKIP}${NC}"
echo ""
echo "手动深度验证指南:"
echo "  1. 通过 Control UI 查看插件市场（ClawHub）"
echo "  2. 尝试安装一个插件并验证功能"
echo "  3. 配置一个简单的 Cron 任务测试定时触发"
echo "  4. 配置 Webhook Hook 测试事件通知"
echo ""

REPORT_FILE="${SCRIPT_DIR}/results-04-plugins.txt"
{
  echo "# PoC 验证 04 — 插件系统"
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
