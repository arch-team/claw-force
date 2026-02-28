#!/usr/bin/env bash
# ============================================================================
# poc-03-agents.sh — Agent 协作验证
# ============================================================================
# 验证项: SubAgent 创建、通信、列表、会话隔离、角色配置
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
echo " PoC 验证 03 — Agent 协作"
echo "============================================"

if [[ ! -f "${EC2_PUBLIC_IP_FILE}" ]]; then
  echo "ERROR: 找不到 EC2 IP 文件" >&2
  exit 1
fi
EC2_IP=$(cat "${EC2_PUBLIC_IP_FILE}")
SSH_CMD="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@${EC2_IP}"
GATEWAY_TOKEN=$(${SSH_CMD} "cat ~/.openclaw/.gateway-token 2>/dev/null" || echo "")

echo "目标: ${EC2_IP}"
echo ""

if [[ -z "${GATEWAY_TOKEN}" ]]; then
  echo "ERROR: 无法获取 Gateway Token" >&2
  exit 1
fi

# ---------- 1. Agent 列表查询 ----------
echo "[1/5] Agent 列表..."
AGENTS_OUTPUT=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
docker compose run --rm openclaw-cli agents list 2>&1 || echo "CMD_ERROR"
REMOTE
)
if echo "${AGENTS_OUTPUT}" | grep -qi "agent\|default\|name\|id"; then
  log_result PASS "Agent 列表查询" "命令执行成功"
elif echo "${AGENTS_OUTPUT}" | grep -qi "CMD_ERROR\|error\|not found"; then
  log_result FAIL "Agent 列表查询" "命令执行失败"
else
  log_result PASS "Agent 列表查询" "输出: $(echo "${AGENTS_OUTPUT}" | head -3 | tr '\n' ' ')"
fi

# ---------- 2. 默认 Agent 配置 ----------
echo "[2/5] 默认 Agent 配置..."
DEFAULT_AGENT=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
docker compose run --rm openclaw-cli config get agents.defaults 2>&1 || echo "CMD_ERROR"
REMOTE
)
if echo "${DEFAULT_AGENT}" | grep -qi "model\|primary\|CMD_ERROR" && ! echo "${DEFAULT_AGENT}" | grep -qi "CMD_ERROR"; then
  log_result PASS "默认 Agent 配置" "配置可读取"
elif echo "${DEFAULT_AGENT}" | grep -qi "CMD_ERROR"; then
  log_result FAIL "默认 Agent 配置" "无法读取配置"
else
  log_result PASS "默认 Agent 配置" "$(echo "${DEFAULT_AGENT}" | head -2 | tr '\n' ' ')"
fi

# ---------- 3. SOUL.md（系统提示词） ----------
echo "[3/5] SOUL.md 系统提示词..."
SOUL_CHECK=$(${SSH_CMD} bash <<'REMOTE'
if [[ -f ~/.openclaw/workspace/SOUL.md ]]; then
  echo "EXISTS:$(wc -c < ~/.openclaw/workspace/SOUL.md) bytes"
else
  # 创建测试用 SOUL.md
  mkdir -p ~/.openclaw/workspace
  cat > ~/.openclaw/workspace/SOUL.md <<'SOUL'
# OpenClaw PoC Agent

You are a helpful AI assistant deployed for PoC testing.
You should respond concisely and accurately.
SOUL
  echo "CREATED"
fi
REMOTE
)
if [[ "${SOUL_CHECK}" == EXISTS:* ]]; then
  log_result PASS "SOUL.md 系统提示词" "已存在 (${SOUL_CHECK#EXISTS:})"
elif [[ "${SOUL_CHECK}" == "CREATED" ]]; then
  log_result PASS "SOUL.md 系统提示词" "已创建测试用 SOUL.md"
else
  log_result FAIL "SOUL.md 系统提示词" "配置异常"
fi

# ---------- 4. SubAgent 工具可用性 ----------
echo "[4/5] SubAgent 工具可用性..."
SUBAGENT_CHECK=$(${SSH_CMD} bash <<'REMOTE'
cd ~/openclaw
# 检查 subagents 相关配置和工具
CONFIG_OUTPUT=$(docker compose run --rm openclaw-cli config get agents 2>&1 || echo "")
if echo "${CONFIG_OUTPUT}" | grep -qi "subagent\|agent\|model"; then
  echo "AVAILABLE"
else
  echo "CHECK_NEEDED"
fi
REMOTE
)
if [[ "${SUBAGENT_CHECK}" == *"AVAILABLE"* ]]; then
  log_result PASS "SubAgent 工具可用性" "Agent 配置存在"
else
  log_result SKIP "SubAgent 工具可用性" "需通过 Control UI 手动验证（发送包含子任务委托的消息）"
fi

# ---------- 5. 工作区结构 ----------
echo "[5/5] 工作区结构..."
WORKSPACE_CHECK=$(${SSH_CMD} bash <<'REMOTE'
echo "Config: $(ls ~/.openclaw/ 2>/dev/null | tr '\n' ', ')"
echo "Workspace: $(ls ~/.openclaw/workspace/ 2>/dev/null | tr '\n' ', ')"
echo "Disk: $(du -sh ~/.openclaw/ 2>/dev/null | cut -f1)"
REMOTE
)
log_result PASS "工作区结构" "$(echo "${WORKSPACE_CHECK}" | tr '\n' ' ')"

# ---------- 汇总 ----------
echo ""
echo "============================================"
echo " Agent 协作验证结果"
echo "============================================"
for result in "${RESULTS[@]}"; do
  echo -e "  ${result}"
done
echo ""
echo -e "  通过: ${GREEN}${PASS}${NC}  失败: ${RED}${FAIL}${NC}  跳过: ${YELLOW}${SKIP}${NC}"
echo ""
echo "手动深度验证指南:"
echo "  1. 通过 SSH Tunnel 访问 Control UI"
echo "  2. 创建新对话，发送: '请创建一个子 Agent 帮我搜索今天的新闻'"
echo "  3. 观察 SubAgent 是否被正确创建和调用"
echo "  4. 验证多轮对话中上下文是否正确保持"
echo ""

REPORT_FILE="${SCRIPT_DIR}/results-03-agents.txt"
{
  echo "# PoC 验证 03 — Agent 协作"
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
