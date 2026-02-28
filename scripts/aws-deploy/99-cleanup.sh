#!/usr/bin/env bash
# ============================================================================
# 99-cleanup.sh — 清理所有 PoC AWS 资源
# ============================================================================
# 安全最佳实践:
#   - 交互确认后再执行删除操作
#   - 按依赖顺序清理（Instance → SG → IAM）
#   - 显示将被删除的资源清单
#   - 支持 --force 跳过确认（CI/CD 场景）
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.env"

FORCE=false
if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

echo "============================================"
echo " Cleanup — 清理 OpenClaw PoC AWS 资源"
echo "============================================"
echo ""

# ---------- 收集资源信息 ----------
echo "扫描资源..."

# EC2 实例
INSTANCE_ID=""
if [[ -f "${EC2_INSTANCE_ID_FILE}" ]]; then
  INSTANCE_ID=$(cat "${EC2_INSTANCE_ID_FILE}")
fi
# 也通过标签查找
TAGGED_INSTANCES=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${INSTANCE_NAME}" "Name=instance-state-name,Values=running,stopped,pending" \
  --query "Reservations[*].Instances[*].InstanceId" --output text \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || echo "")

# Security Group
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${SECURITY_GROUP_NAME}" \
  --query "SecurityGroups[0].GroupId" --output text \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || echo "None")

# IAM
IAM_ROLE_EXISTS="false"
if aws iam get-role --role-name "${IAM_ROLE_NAME}" --profile "${AWS_PROFILE}" &>/dev/null; then
  IAM_ROLE_EXISTS="true"
fi

INSTANCE_PROFILE_EXISTS="false"
if aws iam get-instance-profile --instance-profile-name "${INSTANCE_PROFILE_NAME}" --profile "${AWS_PROFILE}" &>/dev/null; then
  INSTANCE_PROFILE_EXISTS="true"
fi

# Key Pair
KEY_PAIR_EXISTS="false"
if aws ec2 describe-key-pairs --key-names "${EC2_KEY_PAIR_NAME}" \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}" &>/dev/null; then
  KEY_PAIR_EXISTS="true"
fi

# ---------- 显示资源清单 ----------
echo ""
echo "将删除以下资源:"
echo "  EC2 实例:         ${INSTANCE_ID:-无} ${TAGGED_INSTANCES}"
echo "  Security Group:   ${SG_ID}"
echo "  IAM Role:         ${IAM_ROLE_NAME} (${IAM_ROLE_EXISTS})"
echo "  Instance Profile: ${INSTANCE_PROFILE_NAME} (${INSTANCE_PROFILE_EXISTS})"
echo "  Key Pair (AWS):   ${EC2_KEY_PAIR_NAME} (${KEY_PAIR_EXISTS})"
echo "  Key Pair (本地):  ${SSH_KEY_PATH}"
echo "  临时文件:         ${EC2_INSTANCE_ID_FILE}, ${EC2_PUBLIC_IP_FILE}"
echo ""

if [[ "${FORCE}" != "true" ]]; then
  echo -n "确认删除所有资源? (输入 'yes' 确认): "
  read -r CONFIRM
  if [[ "${CONFIRM}" != "yes" ]]; then
    echo "取消清理"
    exit 0
  fi
fi

# ---------- 删除 EC2 实例 ----------
echo ""
echo "[1/5] 终止 EC2 实例..."

ALL_INSTANCES="${INSTANCE_ID} ${TAGGED_INSTANCES}"
ALL_INSTANCES=$(echo "${ALL_INSTANCES}" | tr ' ' '\n' | sort -u | grep -v '^$' | tr '\n' ' ')

for iid in ${ALL_INSTANCES}; do
  if [[ -n "${iid}" && "${iid}" != "None" ]]; then
    echo "  终止: ${iid}"
    aws ec2 terminate-instances \
      --instance-ids "${iid}" \
      --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || true
  fi
done

if [[ -n "${ALL_INSTANCES}" ]]; then
  echo "  等待实例终止..."
  for iid in ${ALL_INSTANCES}; do
    if [[ -n "${iid}" && "${iid}" != "None" ]]; then
      aws ec2 wait instance-terminated \
        --instance-ids "${iid}" \
        --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || true
    fi
  done
fi
echo "  完成"

# ---------- 删除 Security Group ----------
echo ""
echo "[2/5] 删除 Security Group..."
if [[ "${SG_ID}" != "None" && -n "${SG_ID}" ]]; then
  # 需要等待 EC2 实例完全终止后才能删除 SG
  sleep 5
  aws ec2 delete-security-group \
    --group-id "${SG_ID}" \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || {
    echo "  WARNING: 无法删除 Security Group（可能仍有关联资源），稍后重试"
    sleep 15
    aws ec2 delete-security-group \
      --group-id "${SG_ID}" \
      --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || \
      echo "  WARNING: 仍无法删除，请手动清理: ${SG_ID}"
  }
  echo "  完成"
else
  echo "  未找到"
fi

# ---------- 删除 Key Pair ----------
echo ""
echo "[3/5] 删除 Key Pair..."
if [[ "${KEY_PAIR_EXISTS}" == "true" ]]; then
  aws ec2 delete-key-pair \
    --key-name "${EC2_KEY_PAIR_NAME}" \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}"
  echo "  AWS Key Pair 已删除"
fi
if [[ -f "${SSH_KEY_PATH}" ]]; then
  rm -f "${SSH_KEY_PATH}"
  echo "  本地私钥已删除: ${SSH_KEY_PATH}"
fi
echo "  完成"

# ---------- 删除 IAM 资源 ----------
echo ""
echo "[4/5] 删除 IAM 资源..."

# 先从 Instance Profile 移除 Role
if [[ "${INSTANCE_PROFILE_EXISTS}" == "true" ]]; then
  aws iam remove-role-from-instance-profile \
    --instance-profile-name "${INSTANCE_PROFILE_NAME}" \
    --role-name "${IAM_ROLE_NAME}" \
    --profile "${AWS_PROFILE}" 2>/dev/null || true

  aws iam delete-instance-profile \
    --instance-profile-name "${INSTANCE_PROFILE_NAME}" \
    --profile "${AWS_PROFILE}"
  echo "  Instance Profile 已删除"
fi

# 删除 Role 的内联策略
if [[ "${IAM_ROLE_EXISTS}" == "true" ]]; then
  aws iam delete-role-policy \
    --role-name "${IAM_ROLE_NAME}" \
    --policy-name "${IAM_POLICY_NAME}" \
    --profile "${AWS_PROFILE}" 2>/dev/null || true
  echo "  内联策略已删除"

  aws iam delete-role \
    --role-name "${IAM_ROLE_NAME}" \
    --profile "${AWS_PROFILE}"
  echo "  IAM Role 已删除"
fi
echo "  完成"

# ---------- 清理临时文件 ----------
echo ""
echo "[5/5] 清理临时文件..."
rm -f "${EC2_INSTANCE_ID_FILE}" "${EC2_PUBLIC_IP_FILE}"
echo "  完成"

echo ""
echo "============================================"
echo " 清理完成"
echo "============================================"
echo "所有 OpenClaw PoC AWS 资源已删除"
echo ""
echo "请手动检查以确认无残留:"
echo "  aws ec2 describe-instances --filters 'Name=tag:Project,Values=openclaw-poc' --region ${AWS_REGION} --profile ${AWS_PROFILE}"
echo "  aws iam list-roles --profile ${AWS_PROFILE} | grep openclaw"
