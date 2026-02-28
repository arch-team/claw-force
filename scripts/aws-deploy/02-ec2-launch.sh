#!/usr/bin/env bash
# ============================================================================
# 02-ec2-launch.sh — 启动 EC2 实例（安全加固）
# ============================================================================
# 安全最佳实践:
#   - Security Group 限制源 IP（自动检测或手动指定）
#   - IMDSv2 强制启用（防止 SSRF 窃取实例凭证）
#   - EBS 加密（默认启用，保护静态数据）
#   - SSH Key 认证（禁止密码登录）
#   - 最小化开放端口（仅 SSH + Gateway + Bridge）
#   - User Data 自动安装 Docker（无需 root SSH 操作）
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/config.env"

echo "============================================"
echo " EC2 Launch — 安全加固实例"
echo "============================================"

# ---------- 前置检查 ----------
echo "[1/6] 验证 AWS 身份和 Instance Profile..."
aws sts get-caller-identity --profile "${AWS_PROFILE}" --output table || {
  echo "ERROR: AWS 认证失败，请先运行 01-iam-setup.sh" >&2
  exit 1
}

if ! aws iam get-instance-profile --instance-profile-name "${INSTANCE_PROFILE_NAME}" --profile "${AWS_PROFILE}" &>/dev/null; then
  echo "ERROR: Instance Profile '${INSTANCE_PROFILE_NAME}' 不存在。请先运行 01-iam-setup.sh" >&2
  exit 1
fi

# ---------- 检测本机公网 IP ----------
echo ""
echo "[2/6] 配置网络访问控制..."

if [[ -z "${ALLOWED_SSH_CIDR}" ]]; then
  echo "  检测本机公网 IP..."
  MY_IP=$(curl -s --max-time 5 https://checkip.amazonaws.com 2>/dev/null || \
          curl -s --max-time 5 https://api.ipify.org 2>/dev/null || \
          curl -s --max-time 5 https://ifconfig.me 2>/dev/null) || {
    echo "ERROR: 无法检测公网 IP。请手动设置 ALLOWED_SSH_CIDR 环境变量" >&2
    exit 1
  }
  ALLOWED_SSH_CIDR="${MY_IP}/32"
  echo "  检测到 IP: ${MY_IP}"
fi
echo "  SSH 访问限制: ${ALLOWED_SSH_CIDR}"

# ---------- 获取默认 VPC ----------
echo ""
echo "[3/6] 查找默认 VPC..."
DEFAULT_VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=is-default,Values=true" \
  --query "Vpcs[0].VpcId" --output text \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}")

if [[ "${DEFAULT_VPC_ID}" == "None" || -z "${DEFAULT_VPC_ID}" ]]; then
  echo "ERROR: 未找到默认 VPC。请手动创建或使用 aws ec2 create-default-vpc" >&2
  exit 1
fi
echo "  VPC: ${DEFAULT_VPC_ID}"

# ---------- 创建 Security Group ----------
echo ""
echo "[4/6] 创建 Security Group: ${SECURITY_GROUP_NAME}"

SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${SECURITY_GROUP_NAME}" "Name=vpc-id,Values=${DEFAULT_VPC_ID}" \
  --query "SecurityGroups[0].GroupId" --output text \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null)

if [[ "${SG_ID}" != "None" && -n "${SG_ID}" ]]; then
  echo "  Security Group 已存在: ${SG_ID}，清理旧规则..."
  # 清理已有入站规则以确保一致性
  EXISTING_RULES=$(aws ec2 describe-security-groups \
    --group-ids "${SG_ID}" \
    --query "SecurityGroups[0].IpPermissions" --output json \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}")
  if [[ "${EXISTING_RULES}" != "[]" ]]; then
    aws ec2 revoke-security-group-ingress \
      --group-id "${SG_ID}" \
      --ip-permissions "${EXISTING_RULES}" \
      --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || true
  fi
else
  SG_ID=$(aws ec2 create-security-group \
    --group-name "${SECURITY_GROUP_NAME}" \
    --description "OpenClaw PoC - restricted access from deployer IP" \
    --vpc-id "${DEFAULT_VPC_ID}" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Project,Value=openclaw-poc},{Key=ManagedBy,Value=script}]" \
    --query "GroupId" --output text \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}")
  echo "  创建成功: ${SG_ID}"
fi

# Inbound: SSH — 仅允许部署者 IP
aws ec2 authorize-security-group-ingress \
  --group-id "${SG_ID}" \
  --protocol tcp --port 22 \
  --cidr "${ALLOWED_SSH_CIDR}" \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || true

# Inbound: Gateway + Bridge — 根据配置限制 IP
if [[ "${RESTRICT_GATEWAY_ACCESS}" == "true" ]]; then
  GW_CIDR="${ALLOWED_SSH_CIDR}"
  echo "  Gateway/Bridge 端口限制: ${GW_CIDR}"
else
  GW_CIDR="0.0.0.0/0"
  echo "  WARNING: Gateway/Bridge 端口对外开放（建议使用 SSH Tunnel 替代）"
fi

aws ec2 authorize-security-group-ingress \
  --group-id "${SG_ID}" \
  --protocol tcp --port "${OPENCLAW_GATEWAY_PORT}" \
  --cidr "${GW_CIDR}" \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || true

aws ec2 authorize-security-group-ingress \
  --group-id "${SG_ID}" \
  --protocol tcp --port "${OPENCLAW_BRIDGE_PORT}" \
  --cidr "${GW_CIDR}" \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null || true

echo "  入站规则:"
echo "    - 22/tcp    ← ${ALLOWED_SSH_CIDR} (SSH)"
echo "    - ${OPENCLAW_GATEWAY_PORT}/tcp ← ${GW_CIDR} (Gateway)"
echo "    - ${OPENCLAW_BRIDGE_PORT}/tcp ← ${GW_CIDR} (Bridge)"
echo "    - Outbound: 全部放开"

# ---------- SSH Key Pair ----------
echo ""
echo "[5/6] 配置 SSH Key Pair: ${EC2_KEY_PAIR_NAME}"

if aws ec2 describe-key-pairs --key-names "${EC2_KEY_PAIR_NAME}" \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}" &>/dev/null; then
  echo "  Key Pair 已存在于 AWS"
  if [[ ! -f "${SSH_KEY_PATH}" ]]; then
    echo "  WARNING: 本地私钥 ${SSH_KEY_PATH} 不存在"
    echo "  如果无法 SSH 连接，请删除 AWS Key Pair 后重新运行此脚本"
  fi
else
  echo "  创建新 Key Pair..."
  aws ec2 create-key-pair \
    --key-name "${EC2_KEY_PAIR_NAME}" \
    --key-type ed25519 \
    --query "KeyMaterial" --output text \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}" > "${SSH_KEY_PATH}"
  chmod 600 "${SSH_KEY_PATH}"
  echo "  私钥已保存: ${SSH_KEY_PATH} (权限: 600)"
  echo "  请妥善保管此文件，丢失后无法恢复"
fi

# ---------- 启动 EC2 实例 ----------
echo ""
echo "[6/6] 启动 EC2 实例..."

# 获取最新 Ubuntu 24.04 LTS AMI（官方 Canonical）
AMI_ID=$(aws ssm get-parameters \
  --names "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id" \
  --query "Parameters[0].Value" --output text \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null)

if [[ -z "${AMI_ID}" || "${AMI_ID}" == "None" ]]; then
  echo "  SSM 参数不可用，使用 describe-images 查找 AMI..."
  AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" \
              "Name=state,Values=available" \
    --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}")
fi
echo "  AMI: ${AMI_ID} (Ubuntu 24.04 LTS)"

# User Data: 自动安装 Docker + Docker Compose + 安全加固
USER_DATA=$(cat <<'USERDATA'
#!/bin/bash
set -euo pipefail
exec > /var/log/openclaw-userdata.log 2>&1

echo "=== OpenClaw EC2 User Data — $(date -u) ==="

# 系统更新
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# 安装 Docker（官方源）
apt-get install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 将 ubuntu 用户加入 docker 组
usermod -aG docker ubuntu

# 安全加固: 禁用 SSH 密码登录
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

# 启用 UFW 基础防火墙（与 Security Group 双层防护）
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 18789/tcp
ufw allow 18790/tcp
ufw --force enable

# 配置 swap（t3.medium 4GB RAM，2GB swap 足够）
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

echo "=== User Data 完成 — $(date -u) ==="
touch /tmp/openclaw-userdata-done
USERDATA
)

# 检查是否已有运行中的实例
EXISTING_INSTANCE=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${INSTANCE_NAME}" "Name=instance-state-name,Values=running,pending" \
  --query "Reservations[0].Instances[0].InstanceId" --output text \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}" 2>/dev/null)

if [[ "${EXISTING_INSTANCE}" != "None" && -n "${EXISTING_INSTANCE}" ]]; then
  echo "  已有运行中的实例: ${EXISTING_INSTANCE}"
  INSTANCE_ID="${EXISTING_INSTANCE}"
else
  INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "${AMI_ID}" \
    --instance-type "${EC2_INSTANCE_TYPE}" \
    --key-name "${EC2_KEY_PAIR_NAME}" \
    --security-group-ids "${SG_ID}" \
    --iam-instance-profile "Name=${INSTANCE_PROFILE_NAME}" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":${EC2_VOLUME_SIZE},\"VolumeType\":\"gp3\",\"Encrypted\":true}}]" \
    --metadata-options "HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled" \
    --user-data "${USER_DATA}" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${INSTANCE_NAME}},{Key=Project,Value=openclaw-poc},{Key=ManagedBy,Value=script}]" \
    --query "Instances[0].InstanceId" --output text \
    --region "${AWS_REGION}" --profile "${AWS_PROFILE}")
  echo "  实例已启动: ${INSTANCE_ID}"
fi

# 保存实例 ID
echo "${INSTANCE_ID}" > "${EC2_INSTANCE_ID_FILE}"

# 等待实例就绪
echo "  等待实例 Running..."
aws ec2 wait instance-running \
  --instance-ids "${INSTANCE_ID}" \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}"

# 等待状态检查通过
echo "  等待状态检查通过..."
aws ec2 wait instance-status-ok \
  --instance-ids "${INSTANCE_ID}" \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}"

# 获取公网 IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "${INSTANCE_ID}" \
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text \
  --region "${AWS_REGION}" --profile "${AWS_PROFILE}")
echo "${PUBLIC_IP}" > "${EC2_PUBLIC_IP_FILE}"

echo ""
echo "============================================"
echo " EC2 实例就绪"
echo "============================================"
echo "  Instance ID:  ${INSTANCE_ID}"
echo "  Public IP:    ${PUBLIC_IP}"
echo "  Instance Type: ${EC2_INSTANCE_TYPE}"
echo "  Volume:       ${EC2_VOLUME_SIZE}GB gp3 (加密)"
echo "  Key Pair:     ${SSH_KEY_PATH}"
echo ""
echo "安全加固:"
echo "  - IMDSv2 强制启用（防 SSRF 凭证窃取）"
echo "  - EBS 加密（静态数据保护）"
echo "  - SSH 密码登录已禁用"
echo "  - Root SSH 登录已禁用"
echo "  - UFW 防火墙已启用（双层防护）"
echo "  - Security Group 源 IP 限制: ${ALLOWED_SSH_CIDR}"
echo ""
echo "连接方式:"
echo "  ssh -i ${SSH_KEY_PATH} ubuntu@${PUBLIC_IP}"
echo ""
echo "等待 User Data 完成（Docker 安装）:"
echo "  ssh -i ${SSH_KEY_PATH} ubuntu@${PUBLIC_IP} 'tail -f /var/log/openclaw-userdata.log'"
echo ""
echo "下一步: bash 03-deploy-openclaw.sh"
