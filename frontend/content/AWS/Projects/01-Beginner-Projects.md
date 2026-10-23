# Beginner AWS Projects

These four projects are designed to build foundational AWS skills. Complete them in order.

---

## Project 1: Static Website on S3 + CloudFront

**Goal:** Host a static HTML website on S3 and distribute it globally via CloudFront.

**Services:** S3, CloudFront
**Time:** 1–2 hours
**Cost:** ~$0 (within free tier)

---

### Step 1: Create an S3 Bucket (Console)

1. Go to the [AWS Console](https://console.aws.amazon.com) → **S3** → **Create bucket**
2. **Bucket name:** `my-static-website-yourname` (must be globally unique)
3. **AWS Region:** `us-east-1` (or your preferred region)
4. **Object Ownership:** ACLs disabled (recommended)
5. **Block Public Access:** Uncheck "Block all public access" → Acknowledge the warning
6. Leave all other settings as default → **Create bucket**

### Step 2: Create the HTML File

Create this file locally as `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My AWS Static Website</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .card {
            background: white;
            border-radius: 16px;
            padding: 48px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
        }
        h1 { color: #333; font-size: 2rem; margin-bottom: 16px; }
        p { color: #666; font-size: 1.1rem; margin-bottom: 24px; }
        .badge {
            display: inline-block;
            background: #FF9900;
            color: white;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9rem;
        }
        .info { margin-top: 24px; padding: 16px; background: #f5f5f5; border-radius: 8px; }
        .info p { margin: 4px 0; font-size: 0.9rem; color: #555; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Hello from AWS!</h1>
        <p>This page is hosted on <strong>Amazon S3</strong> and delivered via <strong>CloudFront</strong>.</p>
        <span class="badge">Deployed Successfully</span>
        <div class="info">
            <p>Hosted on: Amazon S3</p>
            <p>CDN: Amazon CloudFront</p>
            <p>Region: us-east-1</p>
        </div>
    </div>
</body>
</html>
```

Also create `error.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>404 - Page Not Found</title>
    <style>
        body { font-family: sans-serif; text-align: center; padding: 100px; background: #f0f0f0; }
        h1 { color: #e74c3c; font-size: 4rem; }
        p { color: #666; }
        a { color: #FF9900; text-decoration: none; }
    </style>
</head>
<body>
    <h1>404</h1>
    <p>Page not found.</p>
    <p><a href="/">Go back home</a></p>
</body>
</html>
```

### Step 3: Upload Files to S3

**Console method:**
1. Click on your bucket name → **Upload**
2. **Add files** → select `index.html` and `error.html`
3. Expand **Permissions** → Keep default
4. Click **Upload**

### Step 4: Enable Static Website Hosting

1. In your bucket → **Properties** tab
2. Scroll to **Static website hosting** → **Edit**
3. Select **Enable**
4. **Hosting type:** Host a static website
5. **Index document:** `index.html`
6. **Error document:** `error.html`
7. **Save changes**
8. Note the **Bucket website endpoint** shown (e.g., `http://my-static-website-yourname.s3-website-us-east-1.amazonaws.com`)

### Step 5: Add Bucket Policy for Public Read

1. In your bucket → **Permissions** tab
2. Scroll to **Bucket policy** → **Edit**
3. Paste this policy (replace `my-static-website-yourname` with your actual bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::my-static-website-yourname/*"
        }
    ]
}
```

4. **Save changes**
5. Test: Visit the S3 website endpoint in your browser — you should see your page.

### Step 6: Create CloudFront Distribution

1. Go to **CloudFront** → **Create distribution**
2. **Origin domain:** Select your S3 bucket from the dropdown (use the S3 website endpoint, not the REST endpoint)
3. **Origin path:** Leave empty
4. **Viewer protocol policy:** Redirect HTTP to HTTPS
5. **Allowed HTTP methods:** GET, HEAD
6. **Cache policy:** CachingOptimized (recommended)
7. **Price class:** Use all edge locations (or choose US/Europe only for lower cost)
8. **Default root object:** `index.html`
9. Click **Create distribution**
10. Wait 5–10 minutes for the distribution to deploy (Status: Enabled)
11. Copy the **Distribution domain name** (e.g., `d1abc123xyz.cloudfront.net`)
12. Visit the CloudFront URL in your browser

---

### CLI Equivalent Commands

```bash
# Create S3 bucket
aws s3 mb s3://my-static-website-yourname --region us-east-1

# Disable block public access
aws s3api put-public-access-block \
  --bucket my-static-website-yourname \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Upload files
aws s3 cp index.html s3://my-static-website-yourname/
aws s3 cp error.html s3://my-static-website-yourname/

# Enable static website hosting
aws s3 website s3://my-static-website-yourname/ \
  --index-document index.html \
  --error-document error.html

# Apply bucket policy
aws s3api put-bucket-policy \
  --bucket my-static-website-yourname \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-static-website-yourname/*"
    }]
  }'

# List files in bucket
aws s3 ls s3://my-static-website-yourname/

# Sync local directory to S3 (useful for updates)
aws s3 sync ./website/ s3://my-static-website-yourname/ --delete
```

### What You Learned

- S3 is an object store, not a traditional file server — every file is an "object" with a key
- Static website hosting turns S3 into a basic HTTP server
- Bucket policies control who can access your S3 objects (Principal `*` = everyone)
- CloudFront caches content at edge locations worldwide, reducing latency
- CloudFront also provides HTTPS for free via AWS Certificate Manager
- The difference between S3 REST endpoint and S3 website endpoint (website endpoint needed for redirects)

---

## Project 2: Deploy Node.js App on EC2

**Goal:** Deploy a running Node.js Express API on an EC2 instance with Nginx as a reverse proxy, managed by PM2.

**Services:** EC2, Security Groups, Elastic IP
**Time:** 2–3 hours
**Cost:** ~$0 (t3.micro free tier)

---

### Step 1: Launch EC2 Instance (Console)

1. Go to **EC2** → **Launch Instances**
2. **Name:** `nodejs-server`
3. **AMI:** Ubuntu Server 22.04 LTS (64-bit x86)
4. **Instance type:** `t3.micro` (or `t2.micro` for free tier)
5. **Key pair:** Create new key pair
   - Name: `my-ec2-key`
   - Type: RSA
   - Format: `.pem`
   - Download the `.pem` file — keep it safe, you cannot download it again
6. **Network settings:** Create security group
   - **SSH (port 22):** Source = My IP
   - **HTTP (port 80):** Source = Anywhere (0.0.0.0/0)
   - **Custom TCP (port 3000):** Source = Anywhere (for direct testing)
7. **Storage:** 8 GiB gp3 (default is fine)
8. **Launch instance**
9. Once running, click instance → **Actions** → **Networking** → **Manage IP addresses** → Allocate Elastic IP (optional but keeps IP stable across reboots)

### Step 2: Connect via SSH

```bash
# Move key to a safe location
mv ~/Downloads/my-ec2-key.pem ~/.ssh/

# Set correct permissions (SSH will refuse if permissions are too open)
chmod 400 ~/.ssh/my-ec2-key.pem

# Connect (replace with your instance's Public IP)
ssh -i ~/.ssh/my-ec2-key.pem ubuntu@YOUR_PUBLIC_IP

# Example:
# ssh -i ~/.ssh/my-ec2-key.pem ubuntu@54.123.45.67

# If prompted "Are you sure you want to continue connecting?" type: yes
```

### Step 3: Install Node.js 20 on the EC2 Instance

```bash
# Once connected via SSH, run these commands:

# Update package lists
sudo apt update && sudo apt upgrade -y

# Install curl (usually already installed)
sudo apt install -y curl

# Add NodeSource repository for Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js (includes npm)
sudo apt install -y nodejs

# Verify installation
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x

# Install build tools (needed for some npm packages)
sudo apt install -y build-essential
```

### Step 4: Create the Express Application

```bash
# Create project directory
mkdir -p ~/myapp && cd ~/myapp

# Initialize Node project
npm init -y

# Install Express
npm install express
```

Create `app.js`:

```bash
# Create the application file
cat > app.js << 'EOF'
const express = require('express');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// In-memory data store (for demo purposes)
let items = [
    { id: 1, name: 'Item One', createdAt: new Date().toISOString() },
    { id: 2, name: 'Item Two', createdAt: new Date().toISOString() },
];
let nextId = 3;

// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'Hello from AWS EC2!',
        hostname: os.hostname(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint (used by load balancers)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// GET all items
app.get('/items', (req, res) => {
    res.json({ items, count: items.length });
});

// GET single item
app.get('/items/:id', (req, res) => {
    const item = items.find(i => i.id === parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
});

// POST create item
app.post('/items', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const newItem = { id: nextId++, name, createdAt: new Date().toISOString() };
    items.push(newItem);
    res.status(201).json(newItem);
});

// DELETE item
app.delete('/items/:id', (req, res) => {
    const index = items.findIndex(i => i.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Item not found' });
    const deleted = items.splice(index, 1)[0];
    res.json({ message: 'Deleted', item: deleted });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Hostname: ${os.hostname()}`);
});
EOF
```

Test it:

```bash
# Test directly
node app.js &

# Test the API
curl http://localhost:3000/
curl http://localhost:3000/health
curl http://localhost:3000/items
curl -X POST http://localhost:3000/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item"}'

# Stop the test server
kill %1
```

### Step 5: Install PM2 and Configure Auto-Start

PM2 is a production process manager for Node.js. It keeps your app running and restarts it on crashes.

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your app with PM2
pm2 start app.js --name "myapp"

# Check status
pm2 status

# View logs
pm2 logs myapp

# Configure PM2 to start on system boot
pm2 startup
# Run the command it outputs (will look like: sudo env PATH=... pm2 startup systemd -u ubuntu)

# Save the current PM2 process list so it restarts on reboot
pm2 save

# Useful PM2 commands:
pm2 restart myapp   # Restart the app
pm2 stop myapp      # Stop the app
pm2 delete myapp    # Remove from PM2
pm2 monit           # Interactive monitoring dashboard
pm2 logs            # View all logs
pm2 logs myapp --lines 50  # View last 50 log lines
```

### Step 6: Install and Configure Nginx as Reverse Proxy

Nginx will listen on port 80 (HTTP) and forward requests to your Node.js app on port 3000.

```bash
# Install Nginx
sudo apt install -y nginx

# Start Nginx and enable on boot
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify Nginx is running
sudo systemctl status nginx

# Remove default Nginx config
sudo rm /etc/nginx/sites-enabled/default

# Create new config for your app
sudo tee /etc/nginx/sites-available/myapp << 'EOF'
server {
    listen 80;
    server_name _;  # Matches any hostname

    # Proxy all requests to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx to apply changes
sudo systemctl reload nginx
```

### Step 7: Test in Browser

1. In the AWS console, find your EC2 instance's **Public IPv4 address** (or Elastic IP)
2. Open browser: `http://YOUR_PUBLIC_IP`
3. You should see the JSON response from your Node.js app
4. Test endpoints:
   - `http://YOUR_PUBLIC_IP/health`
   - `http://YOUR_PUBLIC_IP/items`

```bash
# Test from your local machine
curl http://YOUR_PUBLIC_IP/
curl http://YOUR_PUBLIC_IP/health
curl http://YOUR_PUBLIC_IP/items
curl -X POST http://YOUR_PUBLIC_IP/items \
  -H "Content-Type: application/json" \
  -d '{"name": "From outside!"}'
```

### What You Learned

- EC2 instances are virtual machines running in AWS data centers
- Security Groups act as stateful firewalls — you must explicitly allow inbound ports
- Key pairs use asymmetric encryption — `.pem` file is the private key; never share it
- `chmod 400` sets read-only for owner, which SSH requires for security
- PM2 keeps Node.js apps running and handles auto-restart on crashes/reboots
- Nginx as a reverse proxy provides benefits: port 80 access, SSL termination, load balancing, compression
- The architecture: Browser → Port 80 → Nginx → Port 3000 → Node.js

---

## Project 3: IAM Users, Groups, and Roles

**Goal:** Understand AWS identity and access management by creating users, groups, and roles with specific permissions.

**Services:** IAM, AWS CLI
**Time:** 1–2 hours
**Cost:** $0 (IAM is free)

---

### Step 1: Create a Developer IAM Group (Console)

1. Go to **IAM** → **User groups** → **Create group**
2. **Group name:** `Developers`
3. **Attach permissions policies:**
   - Search and add: `AmazonS3ReadOnlyAccess`
   - Search and add: `AmazonEC2ReadOnlyAccess` (this includes DescribeInstances etc.)
4. **Create group**

### Step 2: Create an IAM User

1. **IAM** → **Users** → **Add users**
2. **User name:** `dev-john`
3. **Access type:** Check both:
   - AWS Management Console access (for console login)
   - Programmatic access (for CLI/SDK)
4. **Console password:** Custom password or auto-generated → **Next**
5. **Add user to group:** Select `Developers` → **Next**
6. **Tags:** Add tag `Department = Engineering` (optional but good practice)
7. **Create user**
8. **Download credentials CSV** (contains Access Key ID and Secret — only chance to see secret)

### Step 3: Configure AWS CLI with User Credentials

```bash
# Install AWS CLI (if not already installed)
# macOS:
brew install awscli

# Linux:
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure a named profile for dev-john
aws configure --profile dev-john
# AWS Access Key ID: (paste from CSV)
# AWS Secret Access Key: (paste from CSV)
# Default region name: us-east-1
# Default output format: json

# Test: List S3 buckets (should work with S3 read permissions)
aws s3 ls --profile dev-john

# Test: Describe EC2 instances (should work)
aws ec2 describe-instances --profile dev-john

# Test: Try to create an S3 bucket (should FAIL — read only)
aws s3 mb s3://test-bucket-should-fail --profile dev-john
# Expected error: Access Denied

# Test: Try to stop an EC2 instance (should FAIL — read only)
aws ec2 stop-instances --instance-ids i-1234567890 --profile dev-john
# Expected error: UnauthorizedOperation
```

### Step 4: Create an IAM Role for EC2 to Access S3

IAM Roles are used by AWS services (like EC2) to access other AWS services. No long-term credentials needed.

**Console method:**
1. **IAM** → **Roles** → **Create role**
2. **Trusted entity type:** AWS service
3. **Use case:** EC2
4. **Next**
5. Search and attach: `AmazonS3ReadOnlyAccess`
6. **Role name:** `EC2-S3-ReadOnly-Role`
7. **Description:** "Allows EC2 instances to read from S3"
8. **Create role**

**Attach role to EC2 instance:**
1. Go to **EC2** → select your instance → **Actions** → **Security** → **Modify IAM role**
2. Select `EC2-S3-ReadOnly-Role` → **Update IAM role**

**Test from EC2 instance (no credentials needed!):**
```bash
# SSH into your EC2 instance
ssh -i ~/.ssh/my-ec2-key.pem ubuntu@YOUR_PUBLIC_IP

# Inside EC2, list S3 buckets (uses instance role automatically)
aws s3 ls

# List objects in a specific bucket
aws s3 ls s3://your-bucket-name/

# Try to upload (should fail — read only)
echo "test" > /tmp/test.txt
aws s3 cp /tmp/test.txt s3://your-bucket-name/
# Expected: Access Denied

# View the temporary credentials EC2 uses via instance metadata
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/EC2-S3-ReadOnly-Role
```

### Step 5: CLI Commands Reference for IAM

```bash
# List all users
aws iam list-users

# Create a group
aws iam create-group --group-name Developers

# Attach policy to group
aws iam attach-group-policy \
  --group-name Developers \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess

# Create a user
aws iam create-user --user-name dev-john

# Add user to group
aws iam add-user-to-group --user-name dev-john --group-name Developers

# Create access keys for user
aws iam create-access-key --user-name dev-john

# List groups for a user
aws iam list-groups-for-user --user-name dev-john

# List attached policies for a group
aws iam list-attached-group-policies --group-name Developers

# Create an IAM role (from a trust policy file)
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name EC2-S3-ReadOnly-Role \
  --assume-role-policy-document file://trust-policy.json

# Attach policy to role
aws iam attach-role-policy \
  --role-name EC2-S3-ReadOnly-Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess

# Create instance profile and add role (needed to attach to EC2)
aws iam create-instance-profile --instance-profile-name EC2-S3-ReadOnly-Profile
aws iam add-role-to-instance-profile \
  --instance-profile-name EC2-S3-ReadOnly-Profile \
  --role-name EC2-S3-ReadOnly-Role

# Get your AWS account ID
aws sts get-caller-identity
```

### What You Learned

- **Users** are for humans; **Roles** are for services/applications
- **Groups** make it easy to assign the same permissions to multiple users
- **Policies** are JSON documents that define what actions are allowed/denied
- The principle of **least privilege**: grant only the permissions needed
- IAM is **global** — not region-specific
- Access Keys are long-term credentials (risky); Roles use temporary credentials via STS (more secure)
- EC2 instance metadata at `169.254.169.254` provides temporary credentials from the attached role

---

## Project 4: RDS MySQL Setup with Bastion Host

**Goal:** Create a private RDS MySQL database accessible only through a bastion EC2 host.

**Services:** RDS, EC2, VPC, Security Groups
**Time:** 2–3 hours
**Cost:** ~$1 (destroy RDS after, it's the most expensive here)

---

### Step 1: Create a VPC (if needed) or Use Default

For simplicity, this project uses the default VPC. For production, see Intermediate Project 1.

### Step 2: Create Security Groups

**Bastion Security Group (`bastion-sg`):**
1. **EC2** → **Security Groups** → **Create security group**
2. Name: `bastion-sg`
3. VPC: Default VPC
4. **Inbound rules:**
   - SSH (port 22) — Source: My IP
5. **Outbound rules:** All traffic (default)
6. Create

**RDS Security Group (`rds-sg`):**
1. Create another security group
2. Name: `rds-sg`
3. **Inbound rules:**
   - MySQL/Aurora (port 3306) — Source: `bastion-sg` (type the SG ID, not an IP)
4. **Outbound rules:** All traffic
5. Create

### Step 3: Create RDS Subnet Group

1. Go to **RDS** → **Subnet groups** → **Create DB subnet group**
2. **Name:** `my-rds-subnet-group`
3. **VPC:** Default VPC
4. **Availability Zones:** Select at least 2
5. **Subnets:** Select subnets in different AZs
6. **Create**

### Step 4: Launch RDS MySQL Instance

1. **RDS** → **Create database**
2. **Creation method:** Standard create
3. **Engine:** MySQL
4. **Engine version:** MySQL 8.0.x (latest)
5. **Templates:** Free tier
6. **DB instance identifier:** `my-mysql-db`
7. **Master username:** `admin`
8. **Master password:** `MySecurePass123!` (save this!)
9. **DB instance class:** `db.t3.micro`
10. **Storage:** 20 GiB gp2, disable storage autoscaling
11. **Connectivity:**
    - VPC: Default
    - Subnet group: `my-rds-subnet-group`
    - **Public access: No** (this is the key — private only)
    - VPC security group: Select `rds-sg` (remove the default)
12. **Database name:** `myappdb` (creates initial database)
13. **Backup retention:** 0 days (for this demo — saves cost)
14. **Create database** (takes ~5 minutes)

### Step 5: Launch Bastion EC2 Instance

1. **EC2** → **Launch Instances**
2. **Name:** `bastion-host`
3. **AMI:** Ubuntu 22.04 LTS
4. **Instance type:** t3.micro
5. **Key pair:** Use your existing `my-ec2-key`
6. **Security group:** Select `bastion-sg`
7. **Subnet:** Choose a public subnet (enable auto-assign public IP)
8. **Launch**

### Step 6: Connect to RDS Through the Bastion

```bash
# Step 1: SSH into the bastion
ssh -i ~/.ssh/my-ec2-key.pem ubuntu@BASTION_PUBLIC_IP

# Step 2: Install MySQL client on the bastion
sudo apt update
sudo apt install -y mysql-client

# Step 3: Get your RDS endpoint
# In AWS Console: RDS → your database → Connectivity & security → Endpoint
# It looks like: my-mysql-db.abc123xyz.us-east-1.rds.amazonaws.com

# Step 4: Connect to RDS (replace endpoint with yours)
mysql -h my-mysql-db.abc123xyz.us-east-1.rds.amazonaws.com \
      -u admin \
      -p
# Enter password: MySecurePass123!
```

### Step 7: Work with the Database

```sql
-- Show all databases
SHOW DATABASES;

-- Use our database
USE myappdb;

-- Create a users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role ENUM('admin', 'user', 'viewer') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create a products table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Insert sample users
INSERT INTO users (name, email, role) VALUES
    ('Alice Smith', 'alice@example.com', 'admin'),
    ('Bob Jones', 'bob@example.com', 'user'),
    ('Charlie Brown', 'charlie@example.com', 'user'),
    ('Diana Prince', 'diana@example.com', 'viewer');

-- Insert sample products
INSERT INTO products (name, price, stock, user_id) VALUES
    ('Laptop', 999.99, 50, 1),
    ('Keyboard', 79.99, 200, 1),
    ('Monitor', 349.99, 75, 2),
    ('Mouse', 29.99, 500, 2);

-- Query data
SELECT * FROM users;
SELECT * FROM products;

-- Join query
SELECT 
    p.name AS product,
    p.price,
    p.stock,
    u.name AS owner
FROM products p
JOIN users u ON p.user_id = u.id
ORDER BY p.price DESC;

-- Check table structure
DESCRIBE users;
DESCRIBE products;

-- Show indexes
SHOW INDEX FROM users;

-- Update a record
UPDATE products SET stock = stock - 1 WHERE name = 'Laptop';

-- Delete a record
DELETE FROM users WHERE email = 'charlie@example.com';

-- Exit
EXIT;
```

### Step 8: SSH Tunneling (Alternative Connection Method)

You can also connect to RDS from your local machine using SSH tunneling through the bastion:

```bash
# On your local machine, create an SSH tunnel
# This forwards local port 3307 to the RDS endpoint via the bastion
ssh -i ~/.ssh/my-ec2-key.pem \
    -L 3307:my-mysql-db.abc123xyz.us-east-1.rds.amazonaws.com:3306 \
    -N \
    ubuntu@BASTION_PUBLIC_IP &

# Now connect using localhost:3307 from your local machine
mysql -h 127.0.0.1 -P 3307 -u admin -p

# You can also use MySQL Workbench or TablePlus with the SSH tunnel
```

### Cleanup (to avoid charges)

```bash
# Delete RDS instance
aws rds delete-db-instance \
  --db-instance-identifier my-mysql-db \
  --skip-final-snapshot

# Terminate bastion EC2
aws ec2 terminate-instances --instance-ids i-BASTION_INSTANCE_ID

# Delete security groups (after instances are gone)
aws ec2 delete-security-group --group-name rds-sg
aws ec2 delete-security-group --group-name bastion-sg
```

### What You Learned

- RDS manages database infrastructure (patching, backups, failover) so you don't have to
- "Private" RDS means no direct internet access — connects only from within the VPC
- Security Groups control traffic at the instance level; referencing another SG as a source is more secure than using CIDR blocks
- A bastion host (also called a jump box) is the secure entry point to private resources
- SSH tunneling lets you use local database tools to connect to private RDS
- Multi-AZ deployment (not used here) provides automatic failover for production
- RDS endpoint is a DNS name that always points to the current primary instance (transparent during failover)
