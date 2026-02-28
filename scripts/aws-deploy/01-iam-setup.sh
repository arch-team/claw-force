#!/usr/bin/env bash
# ============================================================================
# 01-iam-setup.sh — 创建 IAM Role + Instance Profile（最小权限原则）
# ============================================================================
# 安全最佳实践:
#   - EC2 Instance Profile 替代 Access Key（无硬编码凭证）
#   - 仅授予 Bedrock 必需的 3 个 API 权限
#   - 限制 Resource 为指定 Region 的 Bedrock 模型
#   - Trust Policy 仅允许 EC2 服务 AssumeRole
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.env"

echo "============================================"
echo " IAM Setup — 最小权限 Bedrock 访问"
echo "============================================"

# ---------- 前置检查 ----------
if ! command -v aws &>/dev/null; then
  echo "ERROR: AWS CLI 未安装。请先安装: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" >&2
  exit 1
fi

echo "[1/4] 验证 AWS 身份..."
CALLER_IDENTITY=$(aws sts get-caller-identity --profile "${AWS_PROFILE}" --output json 2>&1) || {
  echo "ERROR: AWS 认证失败。请检查:" >&2
  echo "  - AWS CLI 是否已配置: aws configure --profile ${AWS_PROFILE}" >&2
  echo "  - 凭证是否有效: aws sts get-caller-identity" >&2
  echo "  - 如使用 SSO: aws sso login --profile ${AWS_PROFILE}" >&2
  exit 1
}
ACCOUNT_ID=$(echo "${CALLER_IDENTITY}" | python3 -c "import sys,json; print(json.load(sys.stdin)['Account'])")
echo "  Account: ${ACCOUNT_ID}"
echo "  Region:  ${AWS_REGION}"

# ---------- 创建 IAM Role ----------
echo ""
echo "[2/4] 创建 IAM Role: ${IAM_ROLE_NAME}"

TRUST_POLICY=$(cat <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)

if aws iam get-role --role-name "${IAM_ROLE_NAME}" --profile "${AWS_PROFILE}" &>/dev/null; then
  echo "  Role 已存在，跳过创建"
else
  aws iam create-role \
    --role-name "${IAM_ROLE_NAME}" \
    --assume-role-policy-document "${TRUST_POLICY}" \
    --description "OpenClaw PoC — EC2 Bedrock access (least privilege)" \
    --tags Key=Project,Value=openclaw-poc Key=ManagedBy,Value=script \
    --profile "${AWS_PROFILE}" \
    --output text --query 'Role.Arn'
  echo "  Role 创建成功"
fi

# ---------- 创建并附加 Bedrock 权限策略（最小权限） ----------
echo ""
echo "[3/4] 配置 Bedrock 访问策略: ${IAM_POLICY_NAME}"

# 最小权限: 仅允许调用模型和列出模型，限制在指定 Region
BEDROCK_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvokeModels",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:${BEDROCK_REGION}::foundation-model/*"
    },
    {
      "Sid": "BedrockListModels",
      "Effect": "Allow",
      "Action": [
        "bedrock:ListFoundationModels",
        "bedrock:GetFoundationModel"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

# 使用 put-role-policy（内联策略）便于清理时一并删除
aws iam put-role-policy \
  --role-name "${IAM_ROLE_NAME}" \
  --policy-name "${IAM_POLICY_NAME}" \
  --policy-document "${BEDROCK_POLICY}" \
  --profile "${AWS_PROFILE}"
echo "  Bedrock 策略已附加（最小权限: InvokeModel + ListModels, Region: ${BEDROCK_REGION}）"

# ---------- 创建 Instance Profile ----------
echo ""
echo "[4/4] 创建 Instance Profile: ${INSTANCE_PROFILE_NAME}"

if aws iam get-instance-profile --instance-profile-name "${INSTANCE_PROFILE_NAME}" --profile "${AWS_PROFILE}" &>/dev/null; then
  echo "  Instance Profile 已存在，跳过创建"
else
  aws iam create-instance-profile \
    --instance-profile-name "${INSTANCE_PROFILE_NAME}" \
    --tags Key=Project,Value=openclaw-poc Key=ManagedBy,Value=script \
    --profile "${AWS_PROFILE}"

  aws iam add-role-to-instance-profile \
    --instance-profile-name "${INSTANCE_PROFILE_NAME}" \
    --role-name "${IAM_ROLE_NAME}" \
    --profile "${AWS_PROFILE}"

  echo "  Instance Profile 创建成功并关联 Role"

  # Instance Profile 需要几秒钟传播
  echo "  等待 IAM 传播（10s）..."
  sleep 10
fi

echo ""
echo "============================================"
echo " IAM 配置完成"
echo "============================================"
echo "  Role:             ${IAM_ROLE_NAME}"
echo "  Policy:           ${IAM_POLICY_NAME} (inline)"
echo "  Instance Profile: ${INSTANCE_PROFILE_NAME}"
echo "  Bedrock Region:   ${BEDROCK_REGION}"
echo ""
echo "权限摘要（最小权限）:"
echo "  - bedrock:InvokeModel              (${BEDROCK_REGION})"
echo "  - bedrock:InvokeModelWithResponseStream (${BEDROCK_REGION})"
echo "  - bedrock:ListFoundationModels     (global)"
echo "  - bedrock:GetFoundationModel       (global)"
echo ""
echo "下一步: bash 02-ec2-launch.sh"
