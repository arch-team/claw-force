#!/usr/bin/env bash
# ============================================================================
# 04-configure-bedrock.sh — 配置 Bedrock 模型发现
# ============================================================================
# 安全最佳实践:
#   - 通过 IAM Role 认证（无 Access Key）
#   - 验证 Bedrock 模型访问权限是否已开通
#   - 不在本地存储任何云端凭证
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.env"

echo "============================================"
echo " Bedrock Configuration — 模型发现配置"
echo "============================================"

# ---------- 读取实例信息 ----------
if [[ ! -f "${EC2_PUBLIC_IP_FILE}" ]]; then
  echo "ERROR: 找不到 EC2 IP 文件。请先运行 02-ec2-launch.sh" >&2
  exit 1
fi
EC2_IP=$(cat "${EC2_PUBLIC_IP_FILE}")
SSH_CMD="ssh -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@${EC2_IP}"

echo "目标实例: ubuntu@${EC2_IP}"

# ---------- 验证 IAM Role 凭证 ----------
echo ""
echo "[1/4] 验证 EC2 Instance 的 IAM Role 凭证..."

IAM_CHECK=$(${SSH_CMD} bash <<'REMOTE_IAM'
# 通过 IMDSv2 获取 token（安全方式）
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

# 获取实例角色名
ROLE_NAME=$(curl -s -H "X-aws-ec2-metadata-token: ${TOKEN}" \
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/")

if [[ -z "${ROLE_NAME}" ]]; then
  echo "FAIL: 未检测到 IAM Role"
  exit 1
fi

echo "OK: IAM Role = ${ROLE_NAME}"

# 验证凭证可用性（不输出凭证内容）
CRED_CHECK=$(curl -s -H "X-aws-ec2-metadata-token: ${TOKEN}" \
  "http://169.254.169.254/latest/meta-data/iam/security-credentials/${ROLE_NAME}" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Code','UNKNOWN'))")

if [[ "${CRED_CHECK}" == "Success" ]]; then
  echo "OK: 临时凭证获取成功"
else
  echo "FAIL: 凭证状态 = ${CRED_CHECK}"
  exit 1
fi
REMOTE_IAM
) || {
  echo "ERROR: IAM Role 验证失败" >&2
  echo "${IAM_CHECK}" >&2
  echo "" >&2
  echo "排查步骤:" >&2
  echo "  1. 确认 01-iam-setup.sh 已成功执行" >&2
  echo "  2. 确认 Instance Profile 已关联到实例" >&2
  echo "  3. 在 AWS Console 检查 EC2 → Instance → Security → IAM Role" >&2
  exit 1
}
echo "  ${IAM_CHECK}"

# ---------- 配置 Bedrock 模型发现 ----------
echo ""
echo "[2/4] 启用 Bedrock 模型发现..."

${SSH_CMD} bash <<REMOTE_BEDROCK
set -euo pipefail
cd ~/openclaw

COMPOSE_ARGS="-f docker-compose.yml"

# 启用 Bedrock 模型发现
docker compose \${COMPOSE_ARGS} run --rm openclaw-cli \
  config set models.bedrockDiscovery.enabled true

# 设置 Bedrock Region
docker compose \${COMPOSE_ARGS} run --rm openclaw-cli \
  config set models.bedrockDiscovery.region "${BEDROCK_REGION}"

echo "  Bedrock Discovery 已启用 (Region: ${BEDROCK_REGION})"
REMOTE_BEDROCK

# ---------- 验证模型列表 ----------
echo ""
echo "[3/4] 验证 Bedrock 模型发现..."

# 重启 Gateway 使配置生效
${SSH_CMD} "cd ~/openclaw && docker compose restart openclaw-gateway"
echo "  Gateway 重启中..."
sleep 10

MODELS_OUTPUT=$(${SSH_CMD} bash <<'REMOTE_MODELS'
cd ~/openclaw
docker compose run --rm openclaw-cli models list 2>&1 || echo "MODELS_LIST_FAILED"
REMOTE_MODELS
)

if echo "${MODELS_OUTPUT}" | grep -qi "bedrock\|anthropic\|claude\|llama\|meta"; then
  echo "  Bedrock 模型发现成功！检测到的模型:"
  echo "${MODELS_OUTPUT}" | grep -i "bedrock\|anthropic\|claude\|llama\|meta\|amazon\|mistral" | head -20
else
  echo "  WARNING: 未检测到 Bedrock 模型"
  echo "  可能原因:"
  echo "    1. Bedrock 模型访问权限未开通（需在 AWS Console → Bedrock → Model access 中申请）"
  echo "    2. Region ${BEDROCK_REGION} 不支持所需模型"
  echo "    3. IAM 权限不足"
  echo ""
  echo "  完整输出:"
  echo "${MODELS_OUTPUT}" | head -30
fi

# ---------- 设置默认模型 ----------
echo ""
echo "[4/4] 设置默认模型..."

${SSH_CMD} bash <<REMOTE_DEFAULT
set -euo pipefail
cd ~/openclaw

# 设置默认模型为 Bedrock Claude
docker compose run --rm openclaw-cli \
  config set agents.defaults.model.primary "${BEDROCK_DEFAULT_MODEL}" 2>/dev/null || \
  echo "  注意: 默认模型设置需要在 Control UI 中手动配置"

echo "  默认模型: ${BEDROCK_DEFAULT_MODEL}"
REMOTE_DEFAULT

echo ""
echo "============================================"
echo " Bedrock 配置完成"
echo "============================================"
echo "  Region:        ${BEDROCK_REGION}"
echo "  Default Model: ${BEDROCK_DEFAULT_MODEL}"
echo "  Discovery:     已启用"
echo ""
echo "如果模型列表为空，请在 AWS Console 中操作:"
echo "  1. 前往 Amazon Bedrock → Model access"
echo "  2. 点击 'Manage model access'"
echo "  3. 勾选 Anthropic Claude 系列模型"
echo "  4. 提交请求并等待审批（通常几分钟）"
echo ""
echo "SSH Tunnel 访问 Control UI:"
echo "  ssh -i ${SSH_KEY_PATH} -L 18789:localhost:18789 ubuntu@${EC2_IP}"
echo "  浏览器: http://localhost:18789"
echo ""
echo "下一步: cd ../poc-verify && bash poc-01-core.sh"
