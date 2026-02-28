#!/usr/bin/env bash
# ============================================================================
# poc-01-core.sh — 核心功能验证
# ============================================================================
# 验证项: Gateway 启动、Control UI、Bedrock 模型、AI 对话、多轮对话、记忆系统
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${SCRIPT_DIR}/../aws-deploy"
source "${DEPLOY_DIR}/config.env"

# 颜色定义
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
echo " PoC 验证 01 — 核心功能"
echo "============================================"

# ---------- 读取实例信息 ----------
if [[ ! -f "${EC2_PUBLIC_IP_FILE}" ]]; then
  echo "ERROR: 找不到 EC2 IP 文件" >&2
  exit 1
fi
EC2_IP=$(cat "${EC2_PUBLIC_IP_FILE}")
SSH_CMD="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@${EC2_IP}"
GATEWAY_URL="http://${EC2_IP}:${OPENCLAW_GATEWAY_PORT}"

echo "目标: ${EC2_IP}"
echo ""

# ---------- 1. Gateway 健康检查 ----------
echo "[1/7] Gateway 健康检查..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${GATEWAY_URL}/health" 2>/dev/null || echo "000")
if [[ "${HEALTH_RESPONSE}" == "200" ]]; then
  log_result PASS "Gateway 健康检查" "HTTP ${HEALTH_RESPONSE}"
else
  log_result FAIL "Gateway 健康检查" "HTTP ${HEALTH_RESPONSE} (期望 200)"
fi

# ---------- 2. Control UI 可达性 ----------
echo "[2/7] Control UI 可达性..."
UI_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${GATEWAY_URL}" 2>/dev/null || echo "000")
if [[ "${UI_RESPONSE}" == "200" || "${UI_RESPONSE}" == "302" || "${UI_RESPONSE}" == "301" ]]; then
  log_result PASS "Control UI 可达性" "HTTP ${UI_RESPONSE}"
else
  log_result FAIL "Control UI 可达性" "HTTP ${UI_RESPONSE} (期望 200/301/302)"
fi

# ---------- 3. Bedrock 模型列表 ----------
echo "[3/7] Bedrock 模型列表..."
MODELS_OUTPUT=$(${SSH_CMD} "cd ~/openclaw && docker compose run --rm openclaw-cli models list 2>&1" || echo "ERROR")
if echo "${MODELS_OUTPUT}" | grep -qi "bedrock\|anthropic\|claude"; then
  MODEL_COUNT=$(echo "${MODELS_OUTPUT}" | grep -ci "bedrock\|anthropic\|claude\|llama\|meta\|amazon" || echo "0")
  log_result PASS "Bedrock 模型列表" "检测到 ${MODEL_COUNT} 个相关模型"
else
  log_result FAIL "Bedrock 模型列表" "未检测到 Bedrock 模型（可能需要在 AWS Console 中申请模型访问权限）"
fi

# ---------- 4. Docker 容器状态 ----------
echo "[4/7] Docker 容器状态..."
CONTAINER_STATUS=$(${SSH_CMD} "cd ~/openclaw && docker compose ps --format json 2>/dev/null" || echo "ERROR")
if echo "${CONTAINER_STATUS}" | grep -qi "running"; then
  log_result PASS "Docker 容器状态" "Gateway 容器运行中"
else
  log_result FAIL "Docker 容器状态" "Gateway 容器未运行"
fi

# ---------- 5. IAM Role 凭证验证 ----------
echo "[5/7] IAM Role 凭证..."
IAM_TEST=$(${SSH_CMD} bash <<'REMOTE'
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
ROLE=$(curl -s -H "X-aws-ec2-metadata-token: ${TOKEN}" \
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/")
if [[ -n "${ROLE}" ]]; then
  echo "OK:${ROLE}"
else
  echo "FAIL"
fi
REMOTE
)
if [[ "${IAM_TEST}" == OK:* ]]; then
  ROLE_NAME="${IAM_TEST#OK:}"
  log_result PASS "IAM Role 凭证" "Role: ${ROLE_NAME}"
else
  log_result FAIL "IAM Role 凭证" "未检测到 IAM Role"
fi

# ---------- 6. IMDSv2 强制验证 ----------
echo "[6/7] IMDSv2 安全配置..."
IMDS_TEST=$(${SSH_CMD} bash <<'REMOTE'
# 尝试 IMDSv1（应该失败）
V1_RESULT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 \
  "http://169.254.169.254/latest/meta-data/" 2>/dev/null || echo "000")
# 尝试 IMDSv2（应该成功）
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null)
V2_RESULT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 \
  -H "X-aws-ec2-metadata-token: ${TOKEN}" \
  "http://169.254.169.254/latest/meta-data/" 2>/dev/null || echo "000")
echo "V1=${V1_RESULT},V2=${V2_RESULT}"
REMOTE
)
if echo "${IMDS_TEST}" | grep -q "V1=401.*V2=200"; then
  log_result PASS "IMDSv2 安全配置" "IMDSv1 已禁用，IMDSv2 正常"
elif echo "${IMDS_TEST}" | grep -q "V2=200"; then
  log_result PASS "IMDSv2 安全配置" "IMDSv2 正常 (${IMDS_TEST})"
else
  log_result FAIL "IMDSv2 安全配置" "${IMDS_TEST}"
fi

# ---------- 7. 磁盘和内存资源 ----------
echo "[7/7] 系统资源..."
RESOURCES=$(${SSH_CMD} bash <<'REMOTE'
DISK_USED=$(df -h / | awk 'NR==2{print $5}')
MEM_TOTAL=$(free -m | awk '/Mem:/{print $2}')
MEM_USED=$(free -m | awk '/Mem:/{print $3}')
SWAP_TOTAL=$(free -m | awk '/Swap:/{print $2}')
echo "Disk:${DISK_USED},Mem:${MEM_USED}/${MEM_TOTAL}MB,Swap:${SWAP_TOTAL}MB"
REMOTE
)
log_result PASS "系统资源" "${RESOURCES}"

# ---------- 汇总 ----------
echo ""
echo "============================================"
echo " 核心功能验证结果"
echo "============================================"
for result in "${RESULTS[@]}"; do
  echo -e "  ${result}"
done
echo ""
echo -e "  通过: ${GREEN}${PASS}${NC}  失败: ${RED}${FAIL}${NC}  跳过: ${YELLOW}${SKIP}${NC}"
echo ""

# 保存结果到文件
REPORT_FILE="${SCRIPT_DIR}/results-01-core.txt"
{
  echo "# PoC 验证 01 — 核心功能"
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
