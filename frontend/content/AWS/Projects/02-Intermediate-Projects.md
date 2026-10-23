# Intermediate AWS Projects

These projects assume you have completed the beginner projects and are comfortable with the AWS console and basic CLI usage.

---

## Project 1: VPC from Scratch

**Goal:** Build a production-grade VPC with public and private subnets across two Availability Zones, with a NAT Gateway for private subnet internet access.

**Services:** VPC, Subnets, Internet Gateway, NAT Gateway, Route Tables, EC2
**Time:** 2–3 hours
**Cost:** ~$1–3 (NAT Gateway has hourly cost — destroy after)

---

### Architecture

```
VPC: 10.0.0.0/16
├── us-east-1a
│   ├── Public Subnet:  10.0.1.0/24  (Bastion, ALB)
│   └── Private Subnet: 10.0.10.0/24 (App servers)
└── us-east-1b
    ├── Public Subnet:  10.0.2.0/24  (ALB second AZ)
    └── Private Subnet: 10.0.20.0/24 (App servers)
Internet Gateway → attached to VPC
NAT Gateway → in public subnet 10.0.1.0/24
```

### Step 1: Create the VPC

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=my-vpc}]' \
  --query 'Vpc.VpcId' \
  --output text)

echo "VPC ID: $VPC_ID"

# Enable DNS hostnames (needed for RDS, ECS, etc.)
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-hostnames '{"Value": true}'

# Enable DNS resolution
aws ec2 modify-vpc-attribute \
  --vpc-id $VPC_ID \
  --enable-dns-support '{"Value": true}'

# Verify
aws ec2 describe-vpcs --vpc-ids $VPC_ID \
  --query 'Vpcs[0].{ID:VpcId,CIDR:CidrBlock,DNS:EnableDnsHostnames}'
```

### Step 2: Create Subnets

```bash
# Public Subnet - AZ 1 (us-east-1a)
PUB_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1a}]' \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Public Subnet 1: $PUB_SUBNET_1"

# Public Subnet - AZ 2 (us-east-1b)
PUB_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=public-subnet-1b}]' \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Public Subnet 2: $PUB_SUBNET_2"

# Private Subnet - AZ 1
PRIV_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.10.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1a}]' \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Private Subnet 1: $PRIV_SUBNET_1"

# Private Subnet - AZ 2
PRIV_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.20.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=private-subnet-1b}]' \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Private Subnet 2: $PRIV_SUBNET_2"

# Enable auto-assign public IPs in public subnets
aws ec2 modify-subnet-attribute \
  --subnet-id $PUB_SUBNET_1 \
  --map-public-ip-on-launch

aws ec2 modify-subnet-attribute \
  --subnet-id $PUB_SUBNET_2 \
  --map-public-ip-on-launch
```

### Step 3: Create and Attach Internet Gateway

```bash
# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=my-igw}]' \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

echo "IGW ID: $IGW_ID"

# Attach IGW to VPC
aws ec2 attach-internet-gateway \
  --internet-gateway-id $IGW_ID \
  --vpc-id $VPC_ID

echo "IGW attached to VPC"
```

### Step 4: Create Elastic IP and NAT Gateway

```bash
# Allocate Elastic IP for NAT Gateway
EIP_ALLOC=$(aws ec2 allocate-address \
  --domain vpc \
  --tag-specifications 'ResourceType=elastic-ip,Tags=[{Key=Name,Value=nat-eip}]' \
  --query 'AllocationId' \
  --output text)

echo "Elastic IP Allocation ID: $EIP_ALLOC"

# Create NAT Gateway in public subnet 1
NAT_GW_ID=$(aws ec2 create-nat-gateway \
  --subnet-id $PUB_SUBNET_1 \
  --allocation-id $EIP_ALLOC \
  --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=my-nat-gw}]' \
  --query 'NatGateway.NatGatewayId' \
  --output text)

echo "NAT Gateway ID: $NAT_GW_ID"

# Wait for NAT Gateway to become available (takes 1-2 minutes)
echo "Waiting for NAT Gateway to be available..."
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW_ID
echo "NAT Gateway is available!"
```

### Step 5: Create Route Tables and Routes

```bash
# ============ PUBLIC ROUTE TABLE ============
PUB_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=public-rt}]' \
  --query 'RouteTable.RouteTableId' \
  --output text)

echo "Public Route Table: $PUB_RT"

# Add default route to Internet Gateway (0.0.0.0/0 → IGW)
aws ec2 create-route \
  --route-table-id $PUB_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID

# Associate public subnets with public route table
aws ec2 associate-route-table \
  --route-table-id $PUB_RT \
  --subnet-id $PUB_SUBNET_1

aws ec2 associate-route-table \
  --route-table-id $PUB_RT \
  --subnet-id $PUB_SUBNET_2

echo "Public subnets associated with public route table"

# ============ PRIVATE ROUTE TABLE ============
PRIV_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=private-rt}]' \
  --query 'RouteTable.RouteTableId' \
  --output text)

echo "Private Route Table: $PRIV_RT"

# Add default route to NAT Gateway (0.0.0.0/0 → NAT GW)
aws ec2 create-route \
  --route-table-id $PRIV_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --nat-gateway-id $NAT_GW_ID

# Associate private subnets with private route table
aws ec2 associate-route-table \
  --route-table-id $PRIV_RT \
  --subnet-id $PRIV_SUBNET_1

aws ec2 associate-route-table \
  --route-table-id $PRIV_RT \
  --subnet-id $PRIV_SUBNET_2

echo "Private subnets associated with private route table"
```

### Step 6: Create Security Groups

```bash
# Bastion security group (allow SSH from your IP)
MY_IP=$(curl -s https://checkip.amazonaws.com)

BASTION_SG=$(aws ec2 create-security-group \
  --group-name bastion-sg \
  --description "Security group for bastion host" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $BASTION_SG \
  --protocol tcp \
  --port 22 \
  --cidr "${MY_IP}/32"

echo "Bastion SG: $BASTION_SG"

# App server security group (allow SSH from bastion, HTTP from anywhere)
APP_SG=$(aws ec2 create-security-group \
  --group-name app-sg \
  --description "Security group for app servers" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow SSH only from bastion SG
aws ec2 authorize-security-group-ingress \
  --group-id $APP_SG \
  --protocol tcp \
  --port 22 \
  --source-group $BASTION_SG

# Allow HTTP from anywhere (within VPC / from ALB)
aws ec2 authorize-security-group-ingress \
  --group-id $APP_SG \
  --protocol tcp \
  --port 80 \
  --cidr 10.0.0.0/16

echo "App SG: $APP_SG"
```

### Step 7: Launch Bastion EC2 in Public Subnet

```bash
# Get latest Ubuntu 22.04 AMI
UBUNTU_AMI=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters 'Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*' \
            'Name=state,Values=available' \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

echo "Ubuntu AMI: $UBUNTU_AMI"

# Launch bastion in public subnet
BASTION_ID=$(aws ec2 run-instances \
  --image-id $UBUNTU_AMI \
  --instance-type t3.micro \
  --key-name my-ec2-key \
  --subnet-id $PUB_SUBNET_1 \
  --security-group-ids $BASTION_SG \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=bastion}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Bastion Instance ID: $BASTION_ID"

# Wait for bastion to be running
aws ec2 wait instance-running --instance-ids $BASTION_ID

# Get public IP
BASTION_IP=$(aws ec2 describe-instances \
  --instance-ids $BASTION_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Bastion Public IP: $BASTION_IP"
```

### Step 8: Launch App EC2 in Private Subnet

```bash
# User data to install nginx on the app server
USER_DATA=$(cat << 'EOF'
#!/bin/bash
apt update -y
apt install -y nginx
systemctl start nginx
systemctl enable nginx
echo "<h1>Hello from Private EC2: $(hostname)</h1>" > /var/www/html/index.html
EOF
)

# Launch app server in private subnet
APP_ID=$(aws ec2 run-instances \
  --image-id $UBUNTU_AMI \
  --instance-type t3.micro \
  --key-name my-ec2-key \
  --subnet-id $PRIV_SUBNET_1 \
  --security-group-ids $APP_SG \
  --user-data "$USER_DATA" \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=app-server}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "App Instance ID: $APP_ID"

aws ec2 wait instance-running --instance-ids $APP_ID

APP_PRIVATE_IP=$(aws ec2 describe-instances \
  --instance-ids $APP_ID \
  --query 'Reservations[0].Instances[0].PrivateIpAddress' \
  --output text)

echo "App Private IP: $APP_PRIVATE_IP"
```

### Step 9: Connect to Private EC2 Through Bastion

```bash
# Method 1: SSH Agent Forwarding (recommended)
# Add your key to SSH agent
ssh-add ~/.ssh/my-ec2-key.pem

# Connect to bastion with agent forwarding (-A flag)
ssh -A ubuntu@$BASTION_IP

# From inside bastion, SSH to private instance (no key needed — agent forwarding provides it)
ssh ubuntu@APP_PRIVATE_IP   # Replace with actual private IP

# Method 2: SSH ProxyJump (one command from your local machine)
ssh -i ~/.ssh/my-ec2-key.pem \
    -J ubuntu@BASTION_IP \
    ubuntu@APP_PRIVATE_IP

# Method 3: SSH Config file (most convenient)
cat >> ~/.ssh/config << EOF

Host bastion
    HostName $BASTION_IP
    User ubuntu
    IdentityFile ~/.ssh/my-ec2-key.pem

Host app-server
    HostName $APP_PRIVATE_IP
    User ubuntu
    IdentityFile ~/.ssh/my-ec2-key.pem
    ProxyJump bastion
EOF

# Now connect simply with:
ssh app-server
```

### Step 10: Verify Internet Access from Private EC2

```bash
# Once connected to the private EC2 (through bastion)

# Check internet access (goes through NAT Gateway)
curl -s https://checkip.amazonaws.com
# This will show the NAT Gateway's Elastic IP — NOT the private EC2's IP

# Test DNS resolution
nslookup google.com

# Test package downloads (also goes through NAT)
sudo apt update

# Check routes
ip route show
# Should see: default via 10.0.10.1 dev eth0

# From your local machine, verify no public IP on private instance
aws ec2 describe-instances --instance-ids $APP_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress'
# Should return: None
```

### Cleanup

```bash
# Delete in reverse order of creation
aws ec2 terminate-instances --instance-ids $BASTION_ID $APP_ID
aws ec2 wait instance-terminated --instance-ids $BASTION_ID $APP_ID

aws ec2 delete-nat-gateway --nat-gateway-id $NAT_GW_ID
# Wait ~1 minute for NAT GW to delete before releasing EIP
sleep 60

aws ec2 release-address --allocation-id $EIP_ALLOC
aws ec2 detach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID
aws ec2 delete-internet-gateway --internet-gateway-id $IGW_ID
aws ec2 delete-subnet --subnet-id $PUB_SUBNET_1
aws ec2 delete-subnet --subnet-id $PUB_SUBNET_2
aws ec2 delete-subnet --subnet-id $PRIV_SUBNET_1
aws ec2 delete-subnet --subnet-id $PRIV_SUBNET_2
aws ec2 delete-route-table --route-table-id $PUB_RT
aws ec2 delete-route-table --route-table-id $PRIV_RT
aws ec2 delete-security-group --group-id $APP_SG
aws ec2 delete-security-group --group-id $BASTION_SG
aws ec2 delete-vpc --vpc-id $VPC_ID
```

---

## Project 2: ALB + Auto Scaling Group

**Goal:** Deploy a fleet of EC2 instances behind an Application Load Balancer with automatic scaling based on CPU utilization.

**Services:** EC2, ALB, Auto Scaling Group, Launch Templates, CloudWatch
**Time:** 2–3 hours
**Cost:** ~$2–4

---

### Step 1: Create Launch Template with User Data

The User Data script runs automatically on every new EC2 instance at launch.

```bash
# Create the user data script
cat > userdata.sh << 'EOF'
#!/bin/bash
apt update -y
apt install -y nginx

# Get instance metadata
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
AZ=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone)
PRIVATE_IP=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)

# Create custom index page showing instance details
cat > /var/www/html/index.html << HTML
<!DOCTYPE html>
<html>
<head>
    <title>AWS Auto Scaling Demo</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .card { background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #FF9900; }
        .info { text-align: left; margin-top: 20px; }
        .info p { padding: 8px; border-bottom: 1px solid #eee; }
        .label { font-weight: bold; color: #555; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Auto Scaling Demo</h1>
        <p>Refresh this page to see different instances respond!</p>
        <div class="info">
            <p><span class="label">Instance ID:</span> $INSTANCE_ID</p>
            <p><span class="label">Availability Zone:</span> $AZ</p>
            <p><span class="label">Private IP:</span> $PRIVATE_IP</p>
            <p><span class="label">Hostname:</span> $(hostname)</p>
        </div>
    </div>
</body>
</html>
HTML

systemctl start nginx
systemctl enable nginx
EOF

# Encode user data to base64 (required by AWS CLI)
USER_DATA_B64=$(base64 -w 0 userdata.sh)

# Get Ubuntu AMI
AMI_ID=$(aws ec2 describe-images \
  --owners 099720109477 \
  --filters 'Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*' \
            'Name=state,Values=available' \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

# Create security group for instances
INSTANCE_SG=$(aws ec2 create-security-group \
  --group-name asg-instances-sg \
  --description "ASG instances security group" \
  --query 'GroupId' \
  --output text)

# Allow HTTP from ALB (we'll tighten this after creating ALB SG)
aws ec2 authorize-security-group-ingress \
  --group-id $INSTANCE_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

echo "Instance SG: $INSTANCE_SG"

# Create Launch Template
LT_ID=$(aws ec2 create-launch-template \
  --launch-template-name my-app-template \
  --version-description "Initial version" \
  --launch-template-data "{
    \"ImageId\": \"$AMI_ID\",
    \"InstanceType\": \"t3.micro\",
    \"KeyName\": \"my-ec2-key\",
    \"SecurityGroupIds\": [\"$INSTANCE_SG\"],
    \"UserData\": \"$USER_DATA_B64\",
    \"TagSpecifications\": [{
      \"ResourceType\": \"instance\",
      \"Tags\": [{\"Key\": \"Name\", \"Value\": \"asg-instance\"}]
    }]
  }" \
  --query 'LaunchTemplate.LaunchTemplateId' \
  --output text)

echo "Launch Template ID: $LT_ID"
```

### Step 2: Create Target Group

```bash
# Get default VPC ID for this demo (or use your custom VPC)
VPC_ID=$(aws ec2 describe-vpcs \
  --filters 'Name=isDefault,Values=true' \
  --query 'Vpcs[0].VpcId' \
  --output text)

echo "Using VPC: $VPC_ID"

# Create Target Group
TG_ARN=$(aws elbv2 create-target-group \
  --name my-app-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id $VPC_ID \
  --health-check-protocol HTTP \
  --health-check-path / \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --target-type instance \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

echo "Target Group ARN: $TG_ARN"
```

### Step 3: Create ALB Security Group and ALB

```bash
# Create ALB security group (allow HTTP from anywhere)
ALB_SG=$(aws ec2 create-security-group \
  --group-name alb-sg \
  --description "ALB security group" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

echo "ALB SG: $ALB_SG"

# Get public subnets (at least 2 AZs required for ALB)
SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
            "Name=mapPublicIpOnLaunch,Values=true" \
  --query 'Subnets[*].SubnetId' \
  --output text | tr '\t' ' ')

echo "Public Subnets: $SUBNETS"

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name my-app-alb \
  --subnets $SUBNETS \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

echo "ALB ARN: $ALB_ARN"

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "ALB DNS: $ALB_DNS"
```

### Step 4: Add ALB Listener

```bash
# Create HTTP listener (forwards to target group)
LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions "[{
    \"Type\": \"forward\",
    \"TargetGroupArn\": \"$TG_ARN\"
  }]" \
  --query 'Listeners[0].ListenerArn' \
  --output text)

echo "Listener ARN: $LISTENER_ARN"
```

### Step 5: Create Auto Scaling Group

```bash
# Get subnet IDs as comma-separated string
SUBNET_LIST=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
            "Name=mapPublicIpOnLaunch,Values=true" \
  --query 'Subnets[*].SubnetId' \
  --output text | tr '\t' ',')

# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name my-app-asg \
  --launch-template "LaunchTemplateId=$LT_ID,Version=\$Latest" \
  --min-size 2 \
  --desired-capacity 2 \
  --max-size 5 \
  --target-group-arns $TG_ARN \
  --vpc-zone-identifier "$SUBNET_LIST" \
  --health-check-type ELB \
  --health-check-grace-period 300 \
  --tags "Key=Name,Value=asg-instance,PropagateAtLaunch=true"

echo "Auto Scaling Group created"

# Check instances launching
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names my-app-asg \
  --query 'AutoScalingGroups[0].{
    Min:MinSize,
    Desired:DesiredCapacity,
    Max:MaxSize,
    Instances:Instances[*].InstanceId
  }'
```

### Step 6: Create CPU Target Tracking Scaling Policy

```bash
# Create scaling policy: scale to maintain 50% average CPU
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name my-app-asg \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 50.0,
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'

echo "Scaling policy created"

# Wait a few minutes for instances to launch and become healthy
echo "Waiting for instances to become healthy..."
sleep 120

# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn $TG_ARN \
  --query 'TargetHealthDescriptions[*].{
    Target:Target.Id,
    Port:Target.Port,
    Health:TargetHealth.State
  }'
```

### Step 7: Test the Setup

```bash
# Wait for ALB to be active
aws elbv2 wait load-balancer-available --load-balancer-arns $ALB_ARN

echo "ALB is ready! DNS: $ALB_DNS"

# Test in your browser: http://ALB_DNS_NAME
# Refresh multiple times to see different instances respond

# Or test with curl
for i in {1..5}; do
  echo "Request $i:"
  curl -s http://$ALB_DNS | grep -E "Instance ID|Private IP|Availability Zone" | sed 's/<[^>]*>//g'
  echo "---"
done
```

### Step 8: Simulate Load and Watch Scaling

```bash
# SSH into one of the instances
INSTANCE_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=asg-instance" \
            "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

# Generate CPU load (runs for 5 minutes)
ssh -i ~/.ssh/my-ec2-key.pem ubuntu@$INSTANCE_IP "
  sudo apt install -y stress
  stress --cpu 2 --timeout 300 &
  echo 'CPU stress started'
"

# Watch Auto Scaling activity
watch -n 10 'aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name my-app-asg \
  --max-items 5 \
  --query "Activities[*].{Status:StatusCode,Desc:Description}"'
```

### Cleanup

```bash
aws autoscaling delete-auto-scaling-group \
  --auto-scaling-group-name my-app-asg \
  --force-delete

sleep 30

aws elbv2 delete-listener --listener-arn $LISTENER_ARN
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN
aws elbv2 delete-target-group --target-group-arn $TG_ARN
aws ec2 delete-launch-template --launch-template-id $LT_ID
aws ec2 delete-security-group --group-id $ALB_SG
aws ec2 delete-security-group --group-id $INSTANCE_SG
```

---

## Project 3: Serverless CRUD API

**Goal:** Build a fully serverless REST API for user management using Lambda, API Gateway, and DynamoDB.

**Services:** Lambda, API Gateway, DynamoDB, IAM
**Time:** 3–4 hours
**Cost:** ~$0 (within generous free tier)

---

### Step 1: Create DynamoDB Table

```bash
# Create Users table with userId as partition key
aws dynamodb create-table \
  --table-name Users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=ServerlessCRUD

# Wait for table to be active
aws dynamodb wait table-exists --table-name Users

echo "DynamoDB table created"
```

### Step 2: Create IAM Role for Lambda

```bash
# Create trust policy
cat > lambda-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create Lambda execution role
LAMBDA_ROLE_ARN=$(aws iam create-role \
  --role-name LambdaCRUDRole \
  --assume-role-policy-document file://lambda-trust.json \
  --query 'Role.Arn' \
  --output text)

echo "Lambda Role ARN: $LAMBDA_ROLE_ARN"

# Attach basic Lambda execution policy (CloudWatch logs)
aws iam attach-role-policy \
  --role-name LambdaCRUDRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach DynamoDB full access policy
aws iam attach-role-policy \
  --role-name LambdaCRUDRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# Wait for role to propagate
sleep 10
```

### Step 3: Create Lambda Functions

**createUser Lambda:**

```bash
mkdir -p lambda && cat > lambda/createUser.js << 'EOF'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        const body = JSON.parse(event.body || '{}');
        const { name, email, role = 'user' } = body;

        // Input validation
        if (!name || !email) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'name and email are required' })
            };
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Invalid email format' })
            };
        }

        const userId = randomUUID();
        const timestamp = new Date().toISOString();

        const user = {
            userId,
            name,
            email,
            role,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        await docClient.send(new PutCommand({
            TableName: 'Users',
            Item: user,
            ConditionExpression: 'attribute_not_exists(userId)'
        }));

        console.log('Created user:', userId);

        return {
            statusCode: 201,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(user)
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
        };
    }
};
EOF
```

**getUser Lambda:**

```bash
cat > lambda/getUser.js << 'EOF'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        const userId = event.pathParameters?.userId;

        if (!userId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'userId path parameter is required' })
            };
        }

        const result = await docClient.send(new GetCommand({
            TableName: 'Users',
            Key: { userId }
        }));

        if (!result.Item) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: `User ${userId} not found` })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(result.Item)
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
EOF
```

**listUsers Lambda:**

```bash
cat > lambda/listUsers.js << 'EOF'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Support pagination via query parameters
        const limit = parseInt(event.queryStringParameters?.limit || '20');
        const lastKey = event.queryStringParameters?.lastKey;

        const params = {
            TableName: 'Users',
            Limit: Math.min(limit, 100) // Cap at 100 items per page
        };

        // Resume from last evaluated key (pagination)
        if (lastKey) {
            params.ExclusiveStartKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
        }

        const result = await docClient.send(new ScanCommand(params));

        // Encode the next page key for the client
        const response = {
            users: result.Items || [],
            count: result.Count,
            scannedCount: result.ScannedCount
        };

        if (result.LastEvaluatedKey) {
            response.nextPageKey = Buffer.from(
                JSON.stringify(result.LastEvaluatedKey)
            ).toString('base64');
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
EOF
```

**deleteUser Lambda:**

```bash
cat > lambda/deleteUser.js << 'EOF'
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        const userId = event.pathParameters?.userId;

        if (!userId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'userId path parameter is required' })
            };
        }

        // Check if user exists first
        const getResult = await docClient.send(new GetCommand({
            TableName: 'Users',
            Key: { userId }
        }));

        if (!getResult.Item) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: `User ${userId} not found` })
            };
        }

        // Delete the user
        await docClient.send(new DeleteCommand({
            TableName: 'Users',
            Key: { userId },
            ConditionExpression: 'attribute_exists(userId)'
        }));

        console.log('Deleted user:', userId);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: 'User deleted', userId })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
EOF
```

### Step 4: Package and Deploy Lambda Functions

```bash
# Package each function (Lambda uses zip archives)
cd lambda

# Each function gets its own zip (they share AWS SDK which is built-in to the Lambda runtime)
zip createUser.zip createUser.js
zip getUser.zip getUser.js
zip listUsers.zip listUsers.js
zip deleteUser.zip deleteUser.js

# Deploy createUser
CREATE_ARN=$(aws lambda create-function \
  --function-name createUser \
  --runtime nodejs20.x \
  --handler createUser.handler \
  --role $LAMBDA_ROLE_ARN \
  --zip-file fileb://createUser.zip \
  --timeout 30 \
  --memory-size 256 \
  --query 'FunctionArn' \
  --output text)

echo "createUser ARN: $CREATE_ARN"

# Deploy getUser
GET_ARN=$(aws lambda create-function \
  --function-name getUser \
  --runtime nodejs20.x \
  --handler getUser.handler \
  --role $LAMBDA_ROLE_ARN \
  --zip-file fileb://getUser.zip \
  --timeout 30 \
  --memory-size 256 \
  --query 'FunctionArn' \
  --output text)

# Deploy listUsers
LIST_ARN=$(aws lambda create-function \
  --function-name listUsers \
  --runtime nodejs20.x \
  --handler listUsers.handler \
  --role $LAMBDA_ROLE_ARN \
  --zip-file fileb://listUsers.zip \
  --timeout 30 \
  --memory-size 256 \
  --query 'FunctionArn' \
  --output text)

# Deploy deleteUser
DELETE_ARN=$(aws lambda create-function \
  --function-name deleteUser \
  --runtime nodejs20.x \
  --handler deleteUser.handler \
  --role $LAMBDA_ROLE_ARN \
  --zip-file fileb://deleteUser.zip \
  --timeout 30 \
  --memory-size 256 \
  --query 'FunctionArn' \
  --output text)

cd ..
```

### Step 5: Create API Gateway

```bash
# Create REST API
API_ID=$(aws apigateway create-rest-api \
  --name "UsersCRUD-API" \
  --description "Serverless CRUD API for Users" \
  --endpoint-configuration types=REGIONAL \
  --query 'id' \
  --output text)

echo "API ID: $API_ID"

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[?path==`/`].id' \
  --output text)

# Create /users resource
USERS_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part users \
  --query 'id' \
  --output text)

# Create /users/{userId} resource
USER_ID_RESOURCE=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $USERS_ID \
  --path-part '{userId}' \
  --query 'id' \
  --output text)

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1

# Create POST /users -> createUser Lambda
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $USERS_ID \
  --http-method POST \
  --authorization-type NONE

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $USERS_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$CREATE_ARN/invocations"

# Create GET /users -> listUsers Lambda
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $USERS_ID \
  --http-method GET \
  --authorization-type NONE

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $USERS_ID \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LIST_ARN/invocations"

# Create GET /users/{userId} -> getUser Lambda
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $USER_ID_RESOURCE \
  --http-method GET \
  --authorization-type NONE

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $USER_ID_RESOURCE \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$GET_ARN/invocations"

# Create DELETE /users/{userId} -> deleteUser Lambda
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $USER_ID_RESOURCE \
  --http-method DELETE \
  --authorization-type NONE

aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $USER_ID_RESOURCE \
  --http-method DELETE \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$DELETE_ARN/invocations"

# Grant API Gateway permission to invoke each Lambda
for FUNC in createUser getUser listUsers deleteUser; do
  aws lambda add-permission \
    --function-name $FUNC \
    --statement-id "apigw-invoke-$FUNC" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*"
done

# Deploy API to 'prod' stage
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --stage-description "Production stage"

API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/prod"
echo "API URL: $API_URL"
```

### Step 6: Test with curl

```bash
# Create a user
curl -X POST $API_URL/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Smith", "email": "alice@example.com", "role": "admin"}'

# Save the userId from the response
USER_ID="<paste userId from response>"

# Get a specific user
curl $API_URL/users/$USER_ID

# List all users
curl $API_URL/users

# List with pagination limit
curl "$API_URL/users?limit=5"

# Delete a user
curl -X DELETE $API_URL/users/$USER_ID

# Verify deletion
curl $API_URL/users/$USER_ID
# Should return 404

# Test validation (missing email)
curl -X POST $API_URL/users \
  -H "Content-Type: application/json" \
  -d '{"name": "No Email"}'
# Should return 400
```

---

## Project 4: CI/CD with GitHub Actions to EC2

**Goal:** Automatically deploy a Node.js application to EC2 whenever code is pushed to the main branch.

**Services:** EC2, CodeDeploy, S3, IAM, GitHub Actions
**Time:** 3–4 hours
**Cost:** ~$0.50

---

### Step 1: Prepare EC2 Instance

```bash
# Launch EC2 (Ubuntu 22.04, t3.micro) in a public subnet
# Use SSH to set it up:

# Install CodeDeploy Agent
sudo apt update
sudo apt install -y ruby-full wget

cd /home/ubuntu
wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto

# Verify CodeDeploy Agent is running
sudo systemctl status codedeploy-agent
sudo systemctl enable codedeploy-agent

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Create app directory
sudo mkdir -p /var/www/myapp
sudo chown ubuntu:ubuntu /var/www/myapp
```

### Step 2: Create S3 Bucket for Artifacts

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws s3 mb s3://codedeploy-artifacts-$ACCOUNT_ID --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket codedeploy-artifacts-$ACCOUNT_ID \
  --versioning-configuration Status=Enabled
```

### Step 3: Create IAM Roles

```bash
# --- Role 1: EC2 Role (allows EC2 to get artifacts from S3 and CodeDeploy) ---
cat > ec2-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ec2.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name EC2CodeDeployRole \
  --assume-role-policy-document file://ec2-trust.json

aws iam attach-role-policy \
  --role-name EC2CodeDeployRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforAWSCodeDeploy

aws iam create-instance-profile --instance-profile-name EC2CodeDeployProfile
aws iam add-role-to-instance-profile \
  --instance-profile-name EC2CodeDeployProfile \
  --role-name EC2CodeDeployRole

# Attach to your EC2 instance
aws ec2 associate-iam-instance-profile \
  --instance-id YOUR_INSTANCE_ID \
  --iam-instance-profile Name=EC2CodeDeployProfile

# --- Role 2: CodeDeploy Service Role ---
cat > codedeploy-trust.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "codedeploy.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

CODEDEPLOY_ROLE_ARN=$(aws iam create-role \
  --role-name CodeDeployServiceRole \
  --assume-role-policy-document file://codedeploy-trust.json \
  --query 'Role.Arn' \
  --output text)

aws iam attach-role-policy \
  --role-name CodeDeployServiceRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole

echo "CodeDeploy Role ARN: $CODEDEPLOY_ROLE_ARN"

# --- Role 3: GitHub Actions OIDC Role ---
# First, create the OIDC provider for GitHub
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

cat > github-trust.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
      },
      "StringLike": {
        "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO:*"
      }
    }
  }]
}
EOF

GITHUB_ROLE_ARN=$(aws iam create-role \
  --role-name GitHubActionsDeployRole \
  --assume-role-policy-document file://github-trust.json \
  --query 'Role.Arn' \
  --output text)

# Create permissions policy for GitHub Actions role
cat > github-permissions.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::codedeploy-artifacts-$ACCOUNT_ID",
        "arn:aws:s3:::codedeploy-artifacts-$ACCOUNT_ID/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "codedeploy:CreateDeployment",
        "codedeploy:GetDeployment",
        "codedeploy:GetDeploymentConfig",
        "codedeploy:GetApplicationRevision",
        "codedeploy:RegisterApplicationRevision"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-name DeployPolicy \
  --policy-document file://github-permissions.json

echo "GitHub Actions Role ARN: $GITHUB_ROLE_ARN"
```

### Step 4: Create CodeDeploy Application and Deployment Group

```bash
# Create application
aws codedeploy create-application \
  --application-name MyNodeApp \
  --compute-platform Server

# Add Name tag to your EC2 instance first
aws ec2 create-tags \
  --resources YOUR_INSTANCE_ID \
  --tags Key=App,Value=MyNodeApp

# Create deployment group
aws codedeploy create-deployment-group \
  --application-name MyNodeApp \
  --deployment-group-name production \
  --service-role-arn $CODEDEPLOY_ROLE_ARN \
  --ec2-tag-filters Key=App,Value=MyNodeApp,Type=KEY_AND_VALUE \
  --deployment-config-name CodeDeployDefault.OneAtATime
```

### Step 5: Create Application Files

**`app.js`:**
```javascript
const express = require('express');
const os = require('os');
const app = express();

app.get('/', (req, res) => {
    res.json({
        message: 'Deployed via GitHub Actions + CodeDeploy!',
        version: process.env.APP_VERSION || '1.0.0',
        hostname: os.hostname(),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => res.json({ status: 'healthy' }));

app.listen(3000, () => console.log('App running on port 3000'));
```

**`appspec.yml`** (in project root):
```yaml
version: 0.0
os: linux
files:
  - source: /
    destination: /var/www/myapp
    overwrite: true

permissions:
  - object: /var/www/myapp
    pattern: "**"
    owner: ubuntu
    group: ubuntu
    mode: 755
    type:
      - directory
      - file

hooks:
  BeforeInstall:
    - location: scripts/before_install.sh
      timeout: 60
      runas: root

  AfterInstall:
    - location: scripts/after_install.sh
      timeout: 120
      runas: ubuntu

  ApplicationStart:
    - location: scripts/start_app.sh
      timeout: 60
      runas: ubuntu

  ValidateService:
    - location: scripts/validate.sh
      timeout: 30
      runas: ubuntu
```

**`scripts/before_install.sh`:**
```bash
#!/bin/bash
set -e
echo "Before Install: Stopping current app..."
pm2 stop myapp 2>/dev/null || true
cd /var/www/myapp && rm -rf node_modules 2>/dev/null || true
```

**`scripts/after_install.sh`:**
```bash
#!/bin/bash
set -e
echo "After Install: Installing dependencies..."
cd /var/www/myapp
npm install --production
echo "Dependencies installed"
```

**`scripts/start_app.sh`:**
```bash
#!/bin/bash
set -e
echo "Starting app..."
cd /var/www/myapp
pm2 start app.js --name myapp || pm2 restart myapp
pm2 save
echo "App started"
```

**`scripts/validate.sh`:**
```bash
#!/bin/bash
echo "Validating service..."
sleep 3
if curl -f http://localhost:3000/health; then
    echo "Validation passed!"
    exit 0
else
    echo "Validation FAILED"
    exit 1
fi
```

### Step 6: GitHub Actions Workflow

Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy to EC2

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  S3_BUCKET: codedeploy-artifacts-YOUR_ACCOUNT_ID
  CODEDEPLOY_APP: MyNodeApp
  CODEDEPLOY_GROUP: production

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # Required for OIDC
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test --if-present

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsDeployRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Create deployment package
        run: |
          zip -r deployment.zip . \
            --exclude "*.git*" \
            --exclude "node_modules/*" \
            --exclude ".github/*"
          echo "Package size: $(du -sh deployment.zip)"

      - name: Upload to S3
        run: |
          TIMESTAMP=$(date +%Y%m%d-%H%M%S)
          S3_KEY="deployments/${TIMESTAMP}-${GITHUB_SHA:0:8}.zip"
          aws s3 cp deployment.zip s3://${{ env.S3_BUCKET }}/$S3_KEY
          echo "S3_KEY=$S3_KEY" >> $GITHUB_ENV

      - name: Create CodeDeploy deployment
        id: deploy
        run: |
          DEPLOYMENT_ID=$(aws codedeploy create-deployment \
            --application-name ${{ env.CODEDEPLOY_APP }} \
            --deployment-group-name ${{ env.CODEDEPLOY_GROUP }} \
            --s3-location bucket=${{ env.S3_BUCKET }},key=${{ env.S3_KEY }},bundleType=zip \
            --query 'deploymentId' \
            --output text)
          echo "DEPLOYMENT_ID=$DEPLOYMENT_ID" >> $GITHUB_ENV
          echo "Deployment ID: $DEPLOYMENT_ID"

      - name: Wait for deployment to complete
        run: |
          aws codedeploy wait deployment-successful \
            --deployment-id ${{ env.DEPLOYMENT_ID }}
          echo "Deployment successful!"

      - name: Print deployment info
        run: |
          aws codedeploy get-deployment \
            --deployment-id ${{ env.DEPLOYMENT_ID }} \
            --query 'deploymentInfo.{Status:status,Duration:deploymentDuration}' \
            --output table
```

### Step 7: Configure GitHub Repository Secrets

In your GitHub repo → Settings → Secrets and variables → Actions → Add:
- `AWS_ACCOUNT_ID` → your 12-digit account ID

Update the workflow to use it:
```yaml
role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsDeployRole
```

### What You Learned

- OIDC eliminates the need to store AWS access keys as GitHub secrets
- CodeDeploy hooks (BeforeInstall, AfterInstall, ApplicationStart, ValidateService) give you control over each deployment phase
- The deployment package (zip) is staged in S3 before being deployed to EC2
- `appspec.yml` is the deployment manifest — CodeDeploy reads it to know what to do
- Zero-downtime deployments are possible with CodeDeploy's deployment strategies (in-place, blue/green)
- GitHub Actions `permissions: id-token: write` is required to request the OIDC token
