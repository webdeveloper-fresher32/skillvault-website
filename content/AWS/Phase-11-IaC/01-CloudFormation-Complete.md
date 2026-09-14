# AWS CloudFormation - Complete Guide

## Table of Contents
1. [What is CloudFormation and IaC Benefits](#what-is-cloudformation)
2. [Template to Stack Relationship](#template-to-stack)
3. [Template Structure](#template-structure)
4. [Parameters](#parameters)
5. [Mappings](#mappings)
6. [Conditions](#conditions)
7. [Resources](#resources)
8. [Outputs](#outputs)
9. [Intrinsic Functions](#intrinsic-functions)
10. [Pseudo Parameters](#pseudo-parameters)
11. [Stack Operations](#stack-operations)
12. [Change Sets](#change-sets)
13. [DeletionPolicy and UpdateReplacePolicy](#deletion-and-update-policy)
14. [Stack Policies](#stack-policies)
15. [Nested Stacks](#nested-stacks)
16. [StackSets](#stacksets)
17. [Drift Detection](#drift-detection)
18. [Complete Working Example](#complete-example)
19. [CloudFormation CLI Commands](#cli-commands)
20. [Interview Q&A](#interview-qa)

---

## 1. What is CloudFormation and IaC Benefits

AWS CloudFormation is AWS's native Infrastructure as Code service. You write a template (in JSON or YAML) that describes the AWS resources you want, and CloudFormation creates and manages those resources for you. CloudFormation orchestrates all the API calls, handles dependencies between resources, and manages the lifecycle (create, update, delete) of your infrastructure as a unit called a "stack."

### How CloudFormation Works

```
You write template (YAML/JSON)
        │
        ▼
CloudFormation Service
        │
        ├── Validates template syntax
        ├── Resolves parameters and references
        ├── Determines creation order (based on dependencies)
        ├── Calls AWS APIs to create resources
        └── Tracks all resources in the stack
```

### IaC Benefits with CloudFormation Specifically

**1. Consistent Environments**
The same template deployed to dev and prod creates identical infrastructure. No more "it works in dev but not prod because someone configured the security group differently."

**2. Version Control**
Templates live in git. Every infrastructure change is a commit, with a pull request, code review, and change history. You can see exactly who changed what and when.

**3. Repeatability**
Need a new environment for a new customer? Run the template again with different parameters. A new environment in minutes, not days.

**4. Automated Dependency Management**
CloudFormation automatically figures out the correct creation order. If your EC2 instance needs a Security Group, and the Security Group needs a VPC, CloudFormation creates the VPC first, then the Security Group, then the EC2 instance — without you specifying the order.

**5. Rollback on Failure**
By default, if any resource in a stack fails to create, CloudFormation rolls back all changes. You never have a partially-created stack in production.

**6. Drift Detection**
CloudFormation can detect when someone manually changes a resource that's managed by a stack (configuration drift), helping you maintain consistency.

**7. Free to Use**
CloudFormation itself has no additional charge. You pay only for the AWS resources it creates.

---

## 2. Template to Stack Relationship

### Template

A CloudFormation template is a blueprint — a YAML or JSON file that describes the infrastructure you want. A template is just a file on your computer or in S3. It has no cost and doesn't create anything by itself.

```
Template (template.yaml)
├── Parameters: what inputs can be provided
├── Mappings: lookup tables
├── Conditions: conditional resource creation
├── Resources: what to create (REQUIRED)
└── Outputs: what values to expose
```

### Stack

When you deploy a template, CloudFormation creates a "stack" — a collection of AWS resources that are managed as a single unit. The stack:
- Has a unique name (within a region)
- Tracks all resources created from the template
- Can be updated (by providing a new template version)
- Can be deleted (which deletes all resources in the stack)

```
Template deployed → Stack created
Stack = {
  Name: "my-production-stack",
  Status: CREATE_COMPLETE,
  Resources: [
    VPC (vpc-12345678),
    Subnet (subnet-abc123),
    EC2 Instance (i-0abcdef1234567890),
    Security Group (sg-12345678)
  ]
}
```

### One Template → Many Stacks

The same template can be deployed multiple times to create multiple independent stacks:

```
web-app-template.yaml
    ├── deploy → stack "web-app-dev"      (dev environment)
    ├── deploy → stack "web-app-staging"  (staging environment)
    └── deploy → stack "web-app-prod"     (production environment)
```

Parameters allow each stack to have different configurations (instance types, VPC CIDRs, etc.) while using the same template.

---

## 3. Template Structure

A CloudFormation template can contain up to seven sections. Only `Resources` is required.

```yaml
AWSTemplateFormatVersion: "2010-09-09"  # Optional, but always include it
Description: "What this template does"   # Optional, human-readable

Parameters:                              # Optional: inputs to the template
  ...

Mappings:                                # Optional: key-value lookup tables
  ...

Conditions:                              # Optional: conditional logic
  ...

Resources:                               # REQUIRED: AWS resources to create
  ...

Outputs:                                 # Optional: values to export/display
  ...
```

### AWSTemplateFormatVersion

```yaml
AWSTemplateFormatVersion: "2010-09-09"
```

Always use `"2010-09-09"` — it is currently the only valid value, but it's good practice to include it for clarity and future-proofing. It tells CloudFormation which template format version to use.

### Description

```yaml
Description: >
  This template creates a 3-tier web application infrastructure:
  VPC with public/private subnets, an EC2 web tier, and RDS database tier.
  Created by the Platform team. Contact: platform@mycompany.com
```

Up to 1024 characters. Use it to document the purpose, owners, and important context. This description appears in the CloudFormation console.

---

## 4. Parameters

Parameters make templates reusable by accepting input values at deployment time. Instead of hardcoding the instance type, you accept it as a parameter, allowing the same template to create a `t3.micro` in dev and `m5.xlarge` in production.

### Parameter Types

| Type | Description | Example |
|---|---|---|
| `String` | Any string value | "production" |
| `Number` | Integer or float | 3, 8.5 |
| `List<Number>` | Comma-delimited list of numbers | "1,2,3" |
| `CommaDelimitedList` | Comma-delimited list of strings | "a,b,c" |
| `AWS::EC2::KeyPair::KeyName` | Validates a real EC2 key pair exists | "my-key-pair" |
| `AWS::EC2::VPC::Id` | Validates a real VPC ID exists | "vpc-12345678" |
| `AWS::EC2::Subnet::Id` | Validates a real Subnet ID exists | "subnet-abc123" |
| `AWS::EC2::SecurityGroup::Id` | Validates a real SG ID exists | "sg-12345678" |
| `AWS::EC2::Image::Id` | Validates a real AMI ID exists | "ami-0abcdef123456789" |
| `AWS::SSM::Parameter::Value<String>` | Fetches a value from SSM Parameter Store | SSM path |

### Parameter Constraints and Properties

```yaml
Parameters:
  # String with allowed values
  Environment:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - staging
      - prod
    Description: "The deployment environment"
    ConstraintDescription: "Must be dev, staging, or prod"

  # Instance type with allowed values
  InstanceType:
    Type: String
    Default: t3.micro
    AllowedValues:
      - t3.micro
      - t3.small
      - t3.medium
      - m5.large
      - m5.xlarge
    Description: "EC2 instance type"

  # Number with min/max constraints
  DesiredCapacity:
    Type: Number
    Default: 2
    MinValue: 1
    MaxValue: 10
    Description: "Desired number of instances in Auto Scaling Group"

  # String with length and pattern constraints
  ApplicationName:
    Type: String
    MinLength: 3
    MaxLength: 50
    AllowedPattern: "[a-z][a-z0-9-]*"
    ConstraintDescription: "Must start with lowercase letter, contain only lowercase letters, numbers, and hyphens"

  # NoEcho: hides the value in the console (for passwords)
  DBPassword:
    Type: String
    NoEcho: true
    MinLength: 8
    MaxLength: 128
    AllowedPattern: "[a-zA-Z0-9!@#$%^&*()_+=]+"
    Description: "RDS database password"

  # AWS-specific type: validates the key pair exists
  KeyPairName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: "EC2 Key Pair for SSH access"

  # SSM Parameter Store integration
  # Fetches the value from SSM at deploy time
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2
    Description: "Latest Amazon Linux 2 AMI (auto-updated)"

  # CommaDelimitedList
  SubnetIds:
    Type: CommaDelimitedList
    Description: "Comma-separated list of subnet IDs for the Auto Scaling Group"
```

### Referencing Parameters

Use `!Ref ParameterName` to use a parameter value:

```yaml
Resources:
  MyInstance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !Ref InstanceType
      ImageId: !Ref LatestAmiId
      KeyName: !Ref KeyPairName
```

### Parameter Groups and Labels (UI Organization)

```yaml
Metadata:
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label:
          default: "Network Configuration"
        Parameters:
          - VpcCidr
          - SubnetIds
      - Label:
          default: "EC2 Configuration"
        Parameters:
          - InstanceType
          - KeyPairName
      - Label:
          default: "Database Configuration"
        Parameters:
          - DBPassword
          - DBInstanceClass
    ParameterLabels:
      VpcCidr:
        default: "VPC CIDR Block"
      InstanceType:
        default: "EC2 Instance Type"
```

---

## 5. Mappings

Mappings are fixed lookup tables embedded in the template. They are not dynamic — the values are hardcoded in the template. Use them for static, environment-specific, or region-specific values.

### Common Use Case: AMI IDs by Region

AMI IDs are region-specific. The same Amazon Linux 2 AMI has a different ID in each region. Mappings solve this elegantly:

```yaml
Mappings:
  RegionToAMI:
    us-east-1:
      AmazonLinux2: ami-0c02fb55956c7d316
      Ubuntu20: ami-04505e74c0741db8d
    us-west-2:
      AmazonLinux2: ami-00ee4df451840fa9d
      Ubuntu20: ami-0892d3c7ee96c0bf7
    ap-southeast-2:
      AmazonLinux2: ami-07620139298af599e
      Ubuntu20: ami-0b7dcd6e6fd797935
    eu-west-1:
      AmazonLinux2: ami-0bb3fad3c0286ebd5
      Ubuntu20: ami-08ca3fed11864d6bb

  EnvironmentConfig:
    dev:
      InstanceType: t3.micro
      MultiAZ: false
      DeletionProtection: false
    staging:
      InstanceType: t3.small
      MultiAZ: false
      DeletionProtection: false
    prod:
      InstanceType: m5.large
      MultiAZ: true
      DeletionProtection: true
```

### Using FindInMap

`Fn::FindInMap` retrieves a value from a mapping using one or two key lookups:

```yaml
# Syntax: !FindInMap [MapName, TopLevelKey, SecondLevelKey]

Resources:
  MyInstance:
    Type: AWS::EC2::Instance
    Properties:
      # Uses the current region and "AmazonLinux2" key
      ImageId: !FindInMap [RegionToAMI, !Ref "AWS::Region", AmazonLinux2]

      # Uses the Environment parameter to look up the instance type
      InstanceType: !FindInMap [EnvironmentConfig, !Ref Environment, InstanceType]
```

### Nested FindInMap

```yaml
Mappings:
  SubnetConfig:
    VPC:
      CIDR: "10.0.0.0/16"
    Public1:
      CIDR: "10.0.1.0/24"
    Private1:
      CIDR: "10.0.2.0/24"

Resources:
  MyVPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !FindInMap [SubnetConfig, VPC, CIDR]
```

---

## 6. Conditions

Conditions allow you to conditionally create resources or set property values based on parameter values or other conditions. This enables a single template to handle multiple scenarios.

### Defining Conditions

```yaml
Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, prod]

  EnableDetailedMonitoring:
    Type: String
    Default: "false"
    AllowedValues: ["true", "false"]

Conditions:
  # Simple condition based on parameter value
  IsProduction: !Equals [!Ref Environment, prod]

  # Negation
  IsNotProduction: !Not [!Equals [!Ref Environment, prod]]

  # Multiple conditions
  IsDetailedMonitoringEnabled: !Equals [!Ref EnableDetailedMonitoring, "true"]

  # AND: production AND detailed monitoring enabled
  IsProdWithDetailedMonitoring:
    !And
      - !Condition IsProduction
      - !Condition IsDetailedMonitoringEnabled

  # OR: production OR detailed monitoring enabled
  NeedsEnhancedSetup:
    !Or
      - !Condition IsProduction
      - !Condition IsDetailedMonitoringEnabled
```

### Using Conditions on Resources

```yaml
Resources:
  # Only created if IsProduction is true
  ProductionAlarm:
    Type: AWS::CloudWatch::Alarm
    Condition: IsProduction
    Properties:
      AlarmName: !Sub "${AWS::StackName}-high-cpu"
      MetricName: CPUUtilization
      Namespace: AWS/EC2
      Threshold: 80
      ...

  # Only created if NOT production (e.g., dev/staging diagnostics)
  DebugBucket:
    Type: AWS::S3::Bucket
    Condition: IsNotProduction
    Properties:
      BucketName: !Sub "${AWS::StackName}-debug-logs"

  # Instance with conditional detailed monitoring
  MyInstance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !If [IsProduction, m5.large, t3.micro]
      Monitoring: !If [IsProduction, true, false]
      # Use AWS::NoValue to completely omit a property conditionally
      IamInstanceProfile: !If
        - IsProduction
        - !Ref ProductionInstanceProfile
        - !Ref AWS::NoValue

  # RDS with conditional MultiAZ
  MyDatabase:
    Type: AWS::RDS::DBInstance
    Properties:
      MultiAZ: !If [IsProduction, true, false]
      DeletionProtection: !If [IsProduction, true, false]
      DBInstanceClass: !If [IsProduction, db.m5.large, db.t3.micro]
      AllocatedStorage: !If [IsProduction, "100", "20"]
```

### Condition Functions Summary

| Function | Syntax | Description |
|---|---|---|
| `Fn::Equals` | `!Equals [value1, value2]` | True if values are equal |
| `Fn::Not` | `!Not [condition]` | Negates a condition |
| `Fn::And` | `!And [cond1, cond2, ...]` | True if all conditions true (min 2, max 10) |
| `Fn::Or` | `!Or [cond1, cond2, ...]` | True if any condition true (min 2, max 10) |
| `Fn::If` | `!If [condName, ifTrue, ifFalse]` | Returns value based on condition |

---

## 7. Resources

The `Resources` section is the only required section in a CloudFormation template. It defines the AWS resources to create.

### Resource Structure

```yaml
Resources:
  LogicalResourceName:       # Your name for the resource (used for references)
    Type: AWS::Service::ResourceType
    DependsOn: OtherResource  # Optional: explicit dependency
    DeletionPolicy: Retain    # Optional: what to do when stack is deleted
    UpdateReplacePolicy: Retain # Optional: what to do when resource is replaced
    Properties:
      PropertyName: PropertyValue
      AnotherProperty: !Ref SomeParameter
```

### Logical Resource Name

- Your internal name for the resource within the template
- Must be alphanumeric (no hyphens or underscores)
- Used to reference this resource from other resources (`!Ref LogicalName`)
- Appears in the CloudFormation console

### Type

The resource type in the format `AWS::Service::Resource`. Examples:
- `AWS::EC2::Instance`
- `AWS::EC2::VPC`
- `AWS::S3::Bucket`
- `AWS::RDS::DBInstance`
- `AWS::IAM::Role`
- `AWS::Lambda::Function`
- `AWS::ECS::Cluster`
- `AWS::CloudFormation::Stack` (nested stack)

A full list of resource types: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-template-resource-type-ref.html

### Properties

Properties are resource-specific. Each resource type has required and optional properties. For example:

```yaml
Resources:
  # VPC
  MyVPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-vpc"
        - Key: Environment
          Value: !Ref Environment

  # Subnet
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref MyVPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs !Ref "AWS::Region"]
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-public-subnet-1"

  # Security Group
  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Web tier security group
      VpcId: !Ref MyVPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
      SecurityGroupEgress:
        - IpProtocol: -1
          CidrIp: 0.0.0.0/0

  # EC2 Instance
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !Ref InstanceType
      ImageId: !FindInMap [RegionToAMI, !Ref "AWS::Region", AmazonLinux2]
      KeyName: !Ref KeyPairName
      SubnetId: !Ref PublicSubnet1
      SecurityGroupIds:
        - !Ref WebSecurityGroup
      IamInstanceProfile: !Ref WebInstanceProfile
      UserData:
        Fn::Base64: |
          #!/bin/bash
          yum update -y
          yum install -y httpd
          systemctl start httpd
          systemctl enable httpd
          echo "<h1>Hello from CloudFormation!</h1>" > /var/www/html/index.html
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-web-server"
```

---

## 8. Outputs

The `Outputs` section declares values that you want to export from the stack. These can be:
- Displayed in the CloudFormation console after deployment
- Accessed via `aws cloudformation describe-stacks`
- Exported for cross-stack reference using `Fn::ImportValue`

### Basic Outputs

```yaml
Outputs:
  WebServerPublicIP:
    Description: "Public IP address of the web server"
    Value: !GetAtt WebServer.PublicIp

  WebServerURL:
    Description: "URL to access the web server"
    Value: !Sub "http://${WebServer.PublicDnsName}"

  VPCId:
    Description: "VPC ID"
    Value: !Ref MyVPC

  SubnetId:
    Description: "Public Subnet ID"
    Value: !Ref PublicSubnet1

  SecurityGroupId:
    Description: "Web Security Group ID"
    Value: !Ref WebSecurityGroup
```

### Cross-Stack Exports

Use `Export.Name` to export a value so other stacks can import it:

```yaml
# In the network stack (stack name: "my-network-stack")
Outputs:
  VPCId:
    Description: "Shared VPC ID"
    Value: !Ref MyVPC
    Export:
      Name: !Sub "${AWS::StackName}-VPCId"  # Export name: "my-network-stack-VPCId"

  PublicSubnet1:
    Description: "Public Subnet 1 ID"
    Value: !Ref PublicSubnet1
    Export:
      Name: !Sub "${AWS::StackName}-PublicSubnet1"
```

```yaml
# In the application stack, import those values
Resources:
  MyInstance:
    Type: AWS::EC2::Instance
    Properties:
      SubnetId: !ImportValue my-network-stack-PublicSubnet1
      # Can also use Sub for dynamic export names:
      VpcId: !ImportValue
        Fn::Sub: "${NetworkStackName}-VPCId"
```

**Important constraint:** You cannot delete a stack that has exported values referenced by other stacks. You must delete the importing stacks first, or update them to remove the `ImportValue` reference.

---

## 9. Intrinsic Functions

Intrinsic functions are built-in CloudFormation functions that perform dynamic actions within templates. They are used within the `Properties` and `Outputs` sections.

### Ref

`!Ref` returns the value of a parameter or the default attribute of a resource.

```yaml
# Reference a Parameter — returns the parameter's value
InstanceType: !Ref InstanceTypeParam

# Reference a Resource — returns the resource's primary identifier
# For a VPC, returns the VPC ID
VpcId: !Ref MyVPC

# For an S3 bucket, returns the bucket name
BucketName: !Ref MyBucket

# For an EC2 instance, returns the instance ID
InstanceId: !Ref MyInstance
```

### Fn::GetAtt

`!GetAtt` returns the value of a specific attribute of a resource. Different from `!Ref` which returns the primary identifier, `GetAtt` accesses secondary attributes.

```yaml
# EC2 instance attributes
PublicIP: !GetAtt MyInstance.PublicIp
PrivateIP: !GetAtt MyInstance.PrivateIp
PublicDns: !GetAtt MyInstance.PublicDnsName

# Load Balancer DNS name
ALBDNS: !GetAtt MyLoadBalancer.DNSName

# IAM Role ARN
RoleArn: !GetAtt MyRole.Arn

# Security Group ID (when you need the ID, not the logical name)
SGId: !GetAtt MySecurityGroup.GroupId

# RDS endpoint
DBEndpoint: !GetAtt MyDBInstance.Endpoint.Address
DBPort: !GetAtt MyDBInstance.Endpoint.Port

# Lambda function ARN
LambdaArn: !GetAtt MyFunction.Arn
```

### Fn::Sub

`!Sub` substitutes variables in a string. It is the most powerful string function. Variables use `${VariableName}` syntax.

```yaml
# Substitute pseudo parameters
BucketName: !Sub "${AWS::AccountId}-${AWS::Region}-my-bucket"
# Result: "123456789012-ap-southeast-2-my-bucket"

# Substitute parameters
ResourceName: !Sub "${Environment}-my-app"
# If Environment=prod, result: "prod-my-app"

# Substitute resource attributes
URL: !Sub "https://${MyLoadBalancer.DNSName}/api"

# Multi-line UserData with variable substitution
UserData:
  Fn::Base64:
    !Sub |
      #!/bin/bash
      echo "Stack: ${AWS::StackName}" >> /var/log/startup.log
      echo "Region: ${AWS::Region}" >> /var/log/startup.log
      echo "DB: ${DBInstance.Endpoint.Address}" >> /var/log/startup.log
      aws s3 cp s3://${ConfigBucket}/config.yaml /etc/app/config.yaml

# With custom variable map (override or add variables)
Fn::Sub:
  - "Hello ${Name}, your endpoint is ${Endpoint}"
  - Name: !Ref UserNameParam
    Endpoint: !GetAtt MyAlb.DNSName
```

### Fn::If

`!If` returns one of two values based on a condition.

```yaml
# Syntax: !If [ConditionName, ValueIfTrue, ValueIfFalse]

InstanceType: !If [IsProduction, m5.large, t3.micro]

MultiAZ: !If [IsProduction, true, false]

# Use AWS::NoValue to omit a property entirely
Tags:
  - Key: Environment
    Value: !Ref Environment
  - !If
    - IsProduction
    - Key: CostCenter
      Value: "9001"
    - !Ref AWS::NoValue

# Nested If
StorageSize: !If
  - IsProduction
  - "1000"
  - !If
    - IsStaging
    - "100"
    - "20"
```

### Fn::Join

`!Join` concatenates a list of values with a delimiter.

```yaml
# Syntax: !Join [delimiter, [value1, value2, ...]]

# Join with no delimiter
FullName: !Join ["", ["my", "-", "bucket"]]
# Result: "my--bucket" ... better to use Sub for this

# Join list with comma
PolicyArns: !Join
  - ","
  - - arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
    - arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess
    - !Sub "arn:aws:iam::${AWS::AccountId}:policy/MyCustomPolicy"

# CIDR blocks joined for reference
AllowedCidrs: !Join
  - ","
  - - "10.0.0.0/8"
    - "172.16.0.0/12"
    - "192.168.0.0/16"
```

### Fn::Select

`!Select` returns a single element from a list by index (0-based).

```yaml
# Syntax: !Select [index, listOfValues]

# Get the first Availability Zone in the region
FirstAZ: !Select [0, !GetAZs !Ref "AWS::Region"]
SecondAZ: !Select [1, !GetAZs !Ref "AWS::Region"]
ThirdAZ: !Select [2, !GetAZs !Ref "AWS::Region"]

# Select from a list parameter
FirstSubnet: !Select [0, !Ref SubnetIdList]
```

### Fn::Split

`!Split` splits a string into a list using a delimiter.

```yaml
# Syntax: !Split [delimiter, sourceString]

# Split a comma-delimited string into a list
SubnetList: !Split [",", "subnet-abc,subnet-def,subnet-ghi"]

# Useful to split an imported value
SubnetList: !Split [",", !ImportValue SharedSubnetIds]
```

### Fn::Base64

`!Base64` returns the Base64 representation of the input string. Required for EC2 UserData.

```yaml
UserData:
  Fn::Base64: |
    #!/bin/bash
    yum update -y
    yum install -y httpd
    systemctl start httpd

# Or using Sub within Base64
UserData:
  Fn::Base64:
    !Sub |
      #!/bin/bash
      echo "Environment: ${Environment}" > /etc/env
```

### Fn::Cidr

`!Cidr` divides a CIDR block into a list of smaller CIDR blocks.

```yaml
# Syntax: !Cidr [ipBlock, count, cidrBits]
# ipBlock: the CIDR to divide
# count: number of CIDRs to generate
# cidrBits: number of bits for the new subnets

# Create 6 /24 subnets from a /16
Subnets: !Cidr [!GetAtt MyVPC.CidrBlock, 6, 8]

# Use Select to get individual subnets
Subnet1Cidr: !Select [0, !Cidr [!GetAtt MyVPC.CidrBlock, 6, 8]]
Subnet2Cidr: !Select [1, !Cidr [!GetAtt MyVPC.CidrBlock, 6, 8]]
```

### Fn::FindInMap

`!FindInMap` returns a value from a Mappings section.

```yaml
# Syntax: !FindInMap [MapName, TopLevelKey, SecondLevelKey]

ImageId: !FindInMap [RegionToAMI, !Ref "AWS::Region", AmazonLinux2]
InstanceType: !FindInMap [EnvironmentConfig, !Ref Environment, InstanceType]
```

### Fn::ImportValue

`!ImportValue` imports a value exported by another stack's Outputs section.

```yaml
# Import a value exported by another stack
VpcId: !ImportValue my-network-stack-VPCId

# Dynamic import name using Sub
SubnetId: !ImportValue
  Fn::Sub: "${NetworkStackName}-PublicSubnet1"
```

### Fn::And, Fn::Or, Fn::Not, Fn::Equals

Used in the Conditions section (covered in section 6 above), but can also be used inside `Fn::If`:

```yaml
Conditions:
  IsProdInSydney:
    !And
      - !Equals [!Ref Environment, prod]
      - !Equals [!Ref "AWS::Region", ap-southeast-2]
```

### Function Reference Summary

| Function | Short Form | Purpose |
|---|---|---|
| `Fn::Ref` | `!Ref` | Resource ID or parameter value |
| `Fn::GetAtt` | `!GetAtt` | Specific resource attribute |
| `Fn::Sub` | `!Sub` | String substitution |
| `Fn::If` | `!If` | Conditional value selection |
| `Fn::Join` | `!Join` | Join list into string |
| `Fn::Select` | `!Select` | Pick element from list by index |
| `Fn::Split` | `!Split` | Split string into list |
| `Fn::Base64` | `!Base64` | Base64 encode a string |
| `Fn::Cidr` | `!Cidr` | Generate CIDR subnet list |
| `Fn::FindInMap` | `!FindInMap` | Look up value in Mappings |
| `Fn::ImportValue` | `!ImportValue` | Import cross-stack export |
| `Fn::And` | `!And` | Logical AND |
| `Fn::Or` | `!Or` | Logical OR |
| `Fn::Not` | `!Not` | Logical NOT |
| `Fn::Equals` | `!Equals` | Equality check |

---

## 10. Pseudo Parameters

Pseudo parameters are predefined parameters that AWS populates automatically. You do not define them — you just reference them with `!Ref` or use them in `!Sub`.

| Pseudo Parameter | Returns |
|---|---|
| `AWS::Region` | Region name: `ap-southeast-2` |
| `AWS::AccountId` | 12-digit account ID: `123456789012` |
| `AWS::StackName` | Stack name: `my-production-stack` |
| `AWS::StackId` | Full stack ARN: `arn:aws:cloudformation:ap-southeast-2:123456789012:stack/...` |
| `AWS::Partition` | `aws`, `aws-cn` (China), or `aws-us-gov` |
| `AWS::URLSuffix` | `amazonaws.com` or `amazonaws.com.cn` |
| `AWS::NoValue` | Removes a property — used in `Fn::If` to conditionally omit properties |
| `AWS::NotificationARNs` | List of SNS ARNs for stack notifications |

### Usage Examples

```yaml
# Region-specific bucket name (must be globally unique)
BucketName: !Sub "${AWS::AccountId}-${AWS::Region}-logs"
# Result: "123456789012-ap-southeast-2-logs"

# IAM ARN with correct partition
PolicyArn: !Sub "arn:${AWS::Partition}:iam::${AWS::AccountId}:policy/MyPolicy"
# Result for commercial: "arn:aws:iam::123456789012:policy/MyPolicy"
# Result for GovCloud: "arn:aws-us-gov:iam::123456789012:policy/MyPolicy"

# Stack-based naming
TagValue: !Sub "Created by stack ${AWS::StackName} in ${AWS::Region}"

# Conditional property removal
SubnetId: !If [UseExistingSubnet, !Ref ExistingSubnetId, !Ref AWS::NoValue]
```

---

## 11. Stack Operations

### Creating a Stack

**Console:** CloudFormation → Create Stack → Upload template

**CLI:**
```bash
# Create stack from a local file
aws cloudformation create-stack \
    --stack-name my-production-stack \
    --template-body file://template.yaml \
    --parameters \
        ParameterKey=Environment,ParameterValue=prod \
        ParameterKey=InstanceType,ParameterValue=m5.large \
        ParameterKey=KeyPairName,ParameterValue=my-key \
    --capabilities CAPABILITY_IAM \
    --region ap-southeast-2

# Create stack from S3 (required for large templates >51,200 bytes)
aws cloudformation create-stack \
    --stack-name my-production-stack \
    --template-url https://s3.amazonaws.com/my-bucket/template.yaml \
    --parameters ParameterKey=Environment,ParameterValue=prod \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM

# Wait for stack creation to complete
aws cloudformation wait stack-create-complete \
    --stack-name my-production-stack
```

**`--capabilities` flags:**
- `CAPABILITY_IAM`: Required if your template creates IAM resources (roles, policies) without custom names
- `CAPABILITY_NAMED_IAM`: Required if your template creates IAM resources with custom names
- `CAPABILITY_AUTO_EXPAND`: Required if your template uses macros (like SAM transforms)

### Updating a Stack

```bash
# Direct update (no preview — be careful in production)
aws cloudformation update-stack \
    --stack-name my-production-stack \
    --template-body file://template-v2.yaml \
    --parameters \
        ParameterKey=Environment,ParameterValue=prod \
        ParameterKey=InstanceType,ParameterValue=m5.xlarge \
        ParameterKey=KeyPairName,UsePreviousValue=true \
    --capabilities CAPABILITY_IAM

# Wait for update to complete
aws cloudformation wait stack-update-complete \
    --stack-name my-production-stack
```

**Important:** `UsePreviousValue=true` keeps the parameter at its current value without re-specifying it. Useful for `NoEcho` parameters like passwords.

### Deleting a Stack

```bash
# Delete a stack (deletes all resources by default)
aws cloudformation delete-stack \
    --stack-name my-production-stack

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete \
    --stack-name my-production-stack
```

### Describing and Monitoring Stacks

```bash
# Get stack status
aws cloudformation describe-stacks \
    --stack-name my-production-stack \
    --query "Stacks[0].StackStatus"

# Get all stack outputs
aws cloudformation describe-stacks \
    --stack-name my-production-stack \
    --query "Stacks[0].Outputs"

# Get stack events (useful for troubleshooting failed deployments)
aws cloudformation describe-stack-events \
    --stack-name my-production-stack \
    --query "StackEvents[?ResourceStatus=='CREATE_FAILED']"

# List all stacks
aws cloudformation list-stacks \
    --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

### Stack Status Values

| Status | Meaning |
|---|---|
| `CREATE_IN_PROGRESS` | Stack creation started |
| `CREATE_COMPLETE` | Stack created successfully |
| `CREATE_FAILED` | Stack creation failed |
| `ROLLBACK_IN_PROGRESS` | Failed creation, rolling back |
| `ROLLBACK_COMPLETE` | Rollback complete (stack creation failed) |
| `UPDATE_IN_PROGRESS` | Update started |
| `UPDATE_COMPLETE` | Update successful |
| `UPDATE_ROLLBACK_IN_PROGRESS` | Failed update, rolling back |
| `UPDATE_ROLLBACK_COMPLETE` | Update rolled back |
| `DELETE_IN_PROGRESS` | Deletion started |
| `DELETE_COMPLETE` | Stack deleted |
| `DELETE_FAILED` | Deletion failed (often due to resources with Retain policy or manually modified resources) |

---

## 12. Change Sets

Change Sets are one of the most important CloudFormation features for production safety. A Change Set shows you exactly what CloudFormation will do before you execute the update.

### Why Change Sets are Critical

Without Change Sets, running an update immediately applies all changes. You only find out what changed after the fact (or worse, after something breaks). Change Sets let you:
1. Preview all additions, modifications, and deletions
2. Identify potentially dangerous changes (e.g., resource replacement that causes downtime)
3. Get approval from a senior engineer before applying
4. Integrate into a deployment pipeline with a manual approval gate

### Understanding Replacement

CloudFormation marks some changes as "Replacement: True" — this means the resource will be **deleted and re-created**, not updated in-place. For a database, this means data loss. For an EC2 instance, this means downtime. The Change Set shows you this before you apply it.

### Creating and Executing Change Sets

```bash
# Step 1: Create a change set (no changes yet)
aws cloudformation create-change-set \
    --stack-name my-production-stack \
    --change-set-name my-update-$(date +%Y%m%d-%H%M%S) \
    --template-body file://template-v2.yaml \
    --parameters ParameterKey=Environment,ParameterValue=prod \
    --capabilities CAPABILITY_IAM \
    --description "Update: increase instance type to m5.xlarge"

# Step 2: Wait for change set to be ready
aws cloudformation wait change-set-create-complete \
    --stack-name my-production-stack \
    --change-set-name my-update-20240101-120000

# Step 3: Review the change set
aws cloudformation describe-change-set \
    --stack-name my-production-stack \
    --change-set-name my-update-20240101-120000

# Step 4: Execute the change set (after review and approval)
aws cloudformation execute-change-set \
    --stack-name my-production-stack \
    --change-set-name my-update-20240101-120000

# Optional: Delete the change set without applying
aws cloudformation delete-change-set \
    --stack-name my-production-stack \
    --change-set-name my-update-20240101-120000
```

### Change Set Output Example

```json
{
  "Changes": [
    {
      "Type": "Resource",
      "ResourceChange": {
        "Action": "Modify",
        "LogicalResourceId": "WebServer",
        "ResourceType": "AWS::EC2::Instance",
        "Replacement": "True",           ← DANGER: instance will be deleted and recreated
        "Details": [
          {
            "Target": {
              "Attribute": "Properties",
              "Name": "InstanceType"
            },
            "Evaluation": "Static",
            "ChangeSource": "DirectModification"
          }
        ]
      }
    },
    {
      "Type": "Resource",
      "ResourceChange": {
        "Action": "Add",
        "LogicalResourceId": "NewS3Bucket",
        "ResourceType": "AWS::S3::Bucket",
        "Replacement": "N/A"             ← Safe: just adding a new resource
      }
    }
  ]
}
```

**Action values:**
- `Add`: New resource being created
- `Modify`: Existing resource being updated
- `Remove`: Resource being deleted

**Replacement values:**
- `True`: Resource will be replaced (deleted and recreated) — potential data loss/downtime
- `False`: Resource will be modified in-place — generally safe
- `Conditional`: Replacement might happen depending on other changes

---

## 13. DeletionPolicy and UpdateReplacePolicy

These two policies control what happens to a resource when a stack is deleted (DeletionPolicy) or when an update requires the resource to be replaced (UpdateReplacePolicy).

### DeletionPolicy

Applied when the stack is deleted OR when a resource is removed from the template.

```yaml
# Default: Delete — resource is deleted when stack is deleted
MyEC2:
  Type: AWS::EC2::Instance
  DeletionPolicy: Delete

# Retain: resource is NOT deleted; it becomes an orphan
MyS3Bucket:
  Type: AWS::S3::Bucket
  DeletionPolicy: Retain

# Snapshot: take a snapshot before deleting (supported: RDS, ElastiCache, Redshift, Neptune)
MyRDSInstance:
  Type: AWS::RDS::DBInstance
  DeletionPolicy: Snapshot
  Properties:
    ...
```

**Important:** With `DeletionPolicy: Retain`, when you try to delete the stack, CloudFormation will complete successfully but the resource still exists in AWS. You must delete it manually.

### UpdateReplacePolicy

Applied when a stack update requires the resource to be replaced (deleted and re-created).

```yaml
# Default: Delete — old resource is deleted after new one is created
MyEC2:
  Type: AWS::EC2::Instance
  UpdateReplacePolicy: Delete

# Retain: keep the old resource when it's replaced
MyLambdaFunction:
  Type: AWS::Lambda::Function
  UpdateReplacePolicy: Retain

# Snapshot: take snapshot of old resource before it's replaced
MyRDSInstance:
  Type: AWS::RDS::DBInstance
  DeletionPolicy: Snapshot       # When stack is deleted
  UpdateReplacePolicy: Snapshot  # When resource is replaced during update
```

### Best Practices by Resource Type

| Resource | DeletionPolicy | UpdateReplacePolicy | Reasoning |
|---|---|---|---|
| RDS, Aurora | `Snapshot` | `Snapshot` | Never lose production database data |
| S3 Bucket (with data) | `Retain` | `Retain` | S3 can't be deleted if non-empty anyway |
| EC2 Instance | `Delete` or `Retain` | `Delete` | Typically stateless; use Retain for stateful |
| ElastiCache | `Snapshot` | `Snapshot` | Preserve cache data |
| Lambda | `Delete` | `Delete` | Stateless function code |
| IAM Role | `Delete` | `Delete` | Roles are stateless |
| CloudWatch Log Group | `Retain` | `Retain` | Preserve logs for audit/compliance |

---

## 14. Stack Policies

Stack Policies protect critical resources within a stack from being accidentally updated or replaced during stack updates. They are IAM-style JSON policies applied to the stack.

### How Stack Policies Work

Once a stack policy is set, any stack update must comply with the policy. By default (no policy), all resources can be updated. With a policy, you can deny updates to specific resources.

**Important:** Stack Policies only apply during stack updates. They do not prevent resource deletion via the resource itself (e.g., via the EC2 console).

### Apply a Stack Policy

```bash
aws cloudformation set-stack-policy \
    --stack-name my-production-stack \
    --stack-policy-body file://stack-policy.json
```

### Example: Protect Production Database

```json
{
  "Statement": [
    {
      "Effect": "Deny",
      "Action": "Update:*",
      "Principal": "*",
      "Resource": "LogicalResourceId/ProductionDatabase"
    },
    {
      "Effect": "Allow",
      "Action": "Update:*",
      "Principal": "*",
      "Resource": "*"
    }
  ]
}
```

### Temporarily Override a Stack Policy

To update a protected resource, provide a temporary override policy during the update. The override only applies to that specific update — the original policy is restored afterward.

```bash
aws cloudformation update-stack \
    --stack-name my-production-stack \
    --template-body file://template-v2.yaml \
    --stack-policy-during-update-body '{
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "Update:*",
                "Principal": "*",
                "Resource": "*"
            }
        ]
    }'
```

### Stack Policy Actions

| Action | Description |
|---|---|
| `Update:Modify` | In-place updates to the resource |
| `Update:Replace` | Resource replacement (delete + recreate) |
| `Update:Delete` | Resource deletion |
| `Update:*` | All update actions |

---

## 15. Nested Stacks

Nested Stacks allow you to reference other CloudFormation stacks within a parent stack. This is the primary mechanism for modularizing large CloudFormation configurations.

### Why Use Nested Stacks

- A single CloudFormation template has limits: 500 resources, 200 outputs, 60 parameters
- Large templates become hard to maintain
- Nested stacks allow you to reuse common infrastructure patterns (VPC, security groups, monitoring) across multiple projects

### Structure

```
root-stack.yaml              (parent stack)
├── network-stack.yaml       (nested: VPC, Subnets, Route Tables)
├── security-stack.yaml      (nested: Security Groups, NACLs)
├── compute-stack.yaml       (nested: EC2, Auto Scaling, Load Balancer)
└── database-stack.yaml      (nested: RDS, Parameter Group, Subnet Group)
```

### Parent Stack Template

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: Root stack for the web application

Parameters:
  Environment:
    Type: String
  TemplatesBucket:
    Type: String
    Description: "S3 bucket containing nested stack templates"

Resources:
  # Nested network stack
  NetworkStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: !Sub "https://s3.amazonaws.com/${TemplatesBucket}/network-stack.yaml"
      Parameters:
        Environment: !Ref Environment
        VpcCidr: "10.0.0.0/16"
      Tags:
        - Key: StackType
          Value: Network

  # Nested compute stack — passes outputs from NetworkStack as parameters
  ComputeStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: NetworkStack
    Properties:
      TemplateURL: !Sub "https://s3.amazonaws.com/${TemplatesBucket}/compute-stack.yaml"
      Parameters:
        Environment: !Ref Environment
        # Access nested stack outputs using GetAtt
        VpcId: !GetAtt NetworkStack.Outputs.VPCId
        SubnetId: !GetAtt NetworkStack.Outputs.PublicSubnet1Id
      Tags:
        - Key: StackType
          Value: Compute

Outputs:
  WebServerURL:
    Value: !GetAtt ComputeStack.Outputs.WebServerURL
    Description: "URL of the web server"
```

### Accessing Nested Stack Outputs

```yaml
# Syntax: !GetAtt NestedStackLogicalName.Outputs.OutputName
VpcId: !GetAtt NetworkStack.Outputs.VPCId
AlbDns: !GetAtt ComputeStack.Outputs.LoadBalancerDNS
```

### Important: Templates Must Be in S3

Nested stack templates must be uploaded to S3 before deploying the parent stack. Local file paths (`file://`) do not work for nested stacks.

```bash
# Upload templates to S3
aws s3 cp network-stack.yaml s3://my-cfn-templates/
aws s3 cp compute-stack.yaml s3://my-cfn-templates/
aws s3 cp root-stack.yaml s3://my-cfn-templates/

# Deploy the root stack
aws cloudformation create-stack \
    --stack-name my-app-root \
    --template-url https://s3.amazonaws.com/my-cfn-templates/root-stack.yaml \
    --parameters ParameterKey=Environment,ParameterValue=prod \
                 ParameterKey=TemplatesBucket,ParameterValue=my-cfn-templates \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
```

---

## 16. StackSets

CloudFormation StackSets extend the functionality of stacks by enabling you to create, update, or delete stacks across multiple AWS accounts and regions with a single operation.

### Use Cases

- Deploy security baselines (IAM roles, Config rules, CloudTrail) to all accounts in an AWS Organization
- Create a shared VPC architecture in multiple regions
- Enforce compliance controls organization-wide
- Deploy monitoring infrastructure to all accounts

### Key Concepts

- **Stack Set:** The CloudFormation template + configuration for multi-account/region deployment
- **Stack Instance:** A reference to a stack in a specific account and region
- **Administrator Account:** The account that creates and manages the StackSet
- **Target Account:** An account where stack instances are created

### Creating a StackSet

```bash
# Using self-managed permissions (requires you to set up IAM roles in each account)
aws cloudformation create-stack-set \
    --stack-set-name security-baseline \
    --template-body file://security-baseline.yaml \
    --parameters ParameterKey=EnableCloudTrail,ParameterValue=true \
    --capabilities CAPABILITY_NAMED_IAM \
    --administration-role-arn arn:aws:iam::ADMIN_ACCOUNT:role/AWSCloudFormationStackSetAdministrationRole \
    --execution-role-name AWSCloudFormationStackSetExecutionRole

# Using service-managed permissions (requires AWS Organizations)
aws cloudformation create-stack-set \
    --stack-set-name security-baseline \
    --template-body file://security-baseline.yaml \
    --permission-model SERVICE_MANAGED \
    --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false
```

### Creating Stack Instances

```bash
# Deploy to specific accounts and regions
aws cloudformation create-stack-instances \
    --stack-set-name security-baseline \
    --accounts 111111111111 222222222222 333333333333 \
    --regions ap-southeast-2 us-east-1 eu-west-1 \
    --operation-preferences MaxConcurrentCount=3,FailureToleranceCount=1

# Deploy to an entire AWS Organizational Unit
aws cloudformation create-stack-instances \
    --stack-set-name security-baseline \
    --deployment-targets OrganizationalUnitIds=ou-abc123 \
    --regions ap-southeast-2 us-east-1 \
    --operation-preferences RegionConcurrencyType=PARALLEL,MaxConcurrentPercentage=33
```

### Updating Stack Instances

```bash
aws cloudformation update-stack-instances \
    --stack-set-name security-baseline \
    --accounts 111111111111 222222222222 \
    --regions ap-southeast-2 \
    --operation-preferences MaxConcurrentCount=1,FailureToleranceCount=0
```

---

## 17. Drift Detection

Drift occurs when the actual configuration of a stack resource differs from the expected configuration defined in the template. This happens when someone manually changes a resource via the console, CLI, or SDK outside of CloudFormation.

### Why Drift is Dangerous

- Your template no longer accurately describes your infrastructure
- Re-deploying the template could overwrite manual changes (or fail)
- Compliance and audit requirements often mandate knowing the exact state of your infrastructure
- Security configurations may have been changed without review

### Detecting Drift

```bash
# Start drift detection on a stack
aws cloudformation detect-stack-drift \
    --stack-name my-production-stack

# Returns a drift detection ID, e.g.:
# StackDriftDetectionId: 1a2b3c4d-5678-90ab-cdef-example11111

# Wait for detection to complete (it's asynchronous)
aws cloudformation wait stack-drift-detection-complete \
    --stack-drift-detection-id 1a2b3c4d-5678-90ab-cdef-example11111

# Check if stack has drifted
aws cloudformation describe-stack-drift-detection-status \
    --stack-drift-detection-id 1a2b3c4d-5678-90ab-cdef-example11111

# Get detailed drift results for all resources
aws cloudformation describe-stack-resource-drifts \
    --stack-name my-production-stack \
    --stack-resource-drift-status-filters MODIFIED DELETED
```

### Drift Status Values

| Status | Meaning |
|---|---|
| `IN_SYNC` | Resource matches the template |
| `MODIFIED` | Resource has been changed from the template |
| `DELETED` | Resource that should exist has been deleted |
| `NOT_CHECKED` | Drift detection not supported for this resource type |

### Example Drift Output

```json
{
  "StackResourceDrifts": [
    {
      "StackId": "arn:aws:cloudformation:...",
      "LogicalResourceId": "WebSecurityGroup",
      "ResourceType": "AWS::EC2::SecurityGroup",
      "StackResourceDriftStatus": "MODIFIED",
      "ExpectedProperties": "{\"GroupDescription\":\"Web server security group\",\"SecurityGroupIngress\":[{\"CidrIp\":\"0.0.0.0/0\",\"FromPort\":443,\"IpProtocol\":\"tcp\",\"ToPort\":443}]}",
      "ActualProperties": "{\"GroupDescription\":\"Web server security group\",\"SecurityGroupIngress\":[{\"CidrIp\":\"0.0.0.0/0\",\"FromPort\":443,\"IpProtocol\":\"tcp\",\"ToPort\":443},{\"CidrIp\":\"0.0.0.0/0\",\"FromPort\":22,\"IpProtocol\":\"tcp\",\"ToPort\":22}]}"
    }
  ]
}
```

This shows that SSH port 22 was manually added to the security group (a potential security incident).

---

## 18. Complete Working Example

Here is a complete, deployable CloudFormation template that creates a VPC, a public subnet, an Internet Gateway, a Security Group, an EC2 instance, and exposes the output URL.

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: >
  Complete example: VPC + EC2 web server with security group.
  Creates a public VPC, deploys an EC2 instance running Apache,
  and outputs the web server URL.

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues: [dev, staging, prod]
    Description: "Deployment environment"

  InstanceType:
    Type: String
    Default: t3.micro
    AllowedValues:
      - t3.micro
      - t3.small
      - t3.medium
      - m5.large
    Description: "EC2 instance type"

  KeyPairName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: "EC2 Key Pair for SSH access"

  AllowSSHFrom:
    Type: String
    Default: "0.0.0.0/0"
    Description: "CIDR block allowed for SSH (restrict to your IP in production)"

  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2

Mappings:
  EnvironmentConfig:
    dev:
      VpcCidr: "10.0.0.0/16"
      PublicSubnetCidr: "10.0.1.0/24"
      EnableDetailedMonitoring: false
    staging:
      VpcCidr: "10.1.0.0/16"
      PublicSubnetCidr: "10.1.1.0/24"
      EnableDetailedMonitoring: false
    prod:
      VpcCidr: "10.2.0.0/16"
      PublicSubnetCidr: "10.2.1.0/24"
      EnableDetailedMonitoring: true

Conditions:
  IsProduction: !Equals [!Ref Environment, prod]

Resources:
  # ---- NETWORKING ----

  MyVPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !FindInMap [EnvironmentConfig, !Ref Environment, VpcCidr]
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-vpc"
        - Key: Environment
          Value: !Ref Environment

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-igw"

  VPCGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref MyVPC
      InternetGatewayId: !Ref InternetGateway

  PublicSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref MyVPC
      CidrBlock: !FindInMap [EnvironmentConfig, !Ref Environment, PublicSubnetCidr]
      AvailabilityZone: !Select [0, !GetAZs !Ref "AWS::Region"]
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-public-subnet"

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref MyVPC
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-public-rt"

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: VPCGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: "0.0.0.0/0"
      GatewayId: !Ref InternetGateway

  SubnetRouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet
      RouteTableId: !Ref PublicRouteTable

  # ---- SECURITY ----

  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: !Sub "${AWS::StackName} web server security group"
      VpcId: !Ref MyVPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: "0.0.0.0/0"
          Description: "HTTP from anywhere"
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: "0.0.0.0/0"
          Description: "HTTPS from anywhere"
        - IpProtocol: tcp
          FromPort: 22
          ToPort: 22
          CidrIp: !Ref AllowSSHFrom
          Description: "SSH from specified CIDR"
      SecurityGroupEgress:
        - IpProtocol: -1
          CidrIp: "0.0.0.0/0"
          Description: "All outbound traffic"
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-web-sg"

  # ---- IAM ----

  WebServerRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub "${AWS::StackName}-web-server-role"
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
        - arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
      Tags:
        - Key: Environment
          Value: !Ref Environment

  WebServerInstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties:
      Roles:
        - !Ref WebServerRole

  # ---- COMPUTE ----

  WebServer:
    Type: AWS::EC2::Instance
    DependsOn: VPCGatewayAttachment
    DeletionPolicy: !If [IsProduction, Retain, Delete]
    Properties:
      InstanceType: !Ref InstanceType
      ImageId: !Ref LatestAmiId
      KeyName: !Ref KeyPairName
      SubnetId: !Ref PublicSubnet
      SecurityGroupIds:
        - !Ref WebSecurityGroup
      IamInstanceProfile: !Ref WebServerInstanceProfile
      Monitoring: !FindInMap [EnvironmentConfig, !Ref Environment, EnableDetailedMonitoring]
      BlockDeviceMappings:
        - DeviceName: /dev/xvda
          Ebs:
            VolumeSize: !If [IsProduction, 50, 20]
            VolumeType: gp3
            Encrypted: true
            DeleteOnTermination: true
      UserData:
        Fn::Base64:
          !Sub |
            #!/bin/bash
            set -e
            yum update -y
            yum install -y httpd aws-cli

            # Start Apache
            systemctl start httpd
            systemctl enable httpd

            # Get instance metadata
            TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
            INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)

            # Create index page
            cat > /var/www/html/index.html << EOF
            <!DOCTYPE html>
            <html>
              <head><title>CloudFormation Demo</title></head>
              <body>
                <h1>Hello from CloudFormation!</h1>
                <p>Stack: ${AWS::StackName}</p>
                <p>Environment: ${Environment}</p>
                <p>Region: ${AWS::Region}</p>
                <p>Instance ID: $INSTANCE_ID</p>
              </body>
            </html>
            EOF

            # Signal CloudFormation that setup is complete
            /opt/aws/bin/cfn-signal -e $? \
              --stack ${AWS::StackName} \
              --resource WebServer \
              --region ${AWS::Region}
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-web-server"
        - Key: Environment
          Value: !Ref Environment

  # ---- MONITORING (Production Only) ----

  HighCPUAlarm:
    Type: AWS::CloudWatch::Alarm
    Condition: IsProduction
    Properties:
      AlarmName: !Sub "${AWS::StackName}-high-cpu"
      AlarmDescription: "CPU utilization exceeded 80%"
      MetricName: CPUUtilization
      Namespace: AWS/EC2
      Dimensions:
        - Name: InstanceId
          Value: !Ref WebServer
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      TreatMissingData: notBreaching

Outputs:
  StackEnvironment:
    Description: "Deployment environment"
    Value: !Ref Environment

  VPCId:
    Description: "VPC ID"
    Value: !Ref MyVPC
    Export:
      Name: !Sub "${AWS::StackName}-VPCId"

  SubnetId:
    Description: "Public Subnet ID"
    Value: !Ref PublicSubnet
    Export:
      Name: !Sub "${AWS::StackName}-SubnetId"

  WebServerInstanceId:
    Description: "Web Server EC2 Instance ID"
    Value: !Ref WebServer

  WebServerPublicIP:
    Description: "Web Server public IP"
    Value: !GetAtt WebServer.PublicIp

  WebServerURL:
    Description: "Web Server URL"
    Value: !Sub "http://${WebServer.PublicDnsName}"

  SSHCommand:
    Description: "Command to SSH into the web server"
    Value: !Sub "ssh -i ${KeyPairName}.pem ec2-user@${WebServer.PublicDnsName}"
```

### Deploying the Example

```bash
# Validate the template
aws cloudformation validate-template --template-body file://template.yaml

# Deploy
aws cloudformation create-stack \
    --stack-name cfn-example-dev \
    --template-body file://template.yaml \
    --parameters \
        ParameterKey=Environment,ParameterValue=dev \
        ParameterKey=InstanceType,ParameterValue=t3.micro \
        ParameterKey=KeyPairName,ParameterValue=my-key-pair \
    --capabilities CAPABILITY_NAMED_IAM \
    --region ap-southeast-2

# Wait for completion
aws cloudformation wait stack-create-complete --stack-name cfn-example-dev

# Get outputs
aws cloudformation describe-stacks \
    --stack-name cfn-example-dev \
    --query "Stacks[0].Outputs" \
    --output table
```

---

## 19. CloudFormation CLI Commands

### Template Validation

```bash
# Validate template syntax (does NOT validate resource properties)
aws cloudformation validate-template \
    --template-body file://template.yaml

# Validate template in S3
aws cloudformation validate-template \
    --template-url https://s3.amazonaws.com/my-bucket/template.yaml
```

### Stack Management

```bash
# Create stack
aws cloudformation create-stack --stack-name NAME --template-body file://t.yaml --parameters ... --capabilities CAPABILITY_IAM

# Update stack
aws cloudformation update-stack --stack-name NAME --template-body file://t.yaml --parameters ...

# Delete stack
aws cloudformation delete-stack --stack-name NAME

# List stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Describe stack
aws cloudformation describe-stacks --stack-name NAME

# Describe stack resources (all resources in the stack with their physical IDs)
aws cloudformation describe-stack-resources --stack-name NAME

# Get stack events (for troubleshooting)
aws cloudformation describe-stack-events --stack-name NAME
```

### Change Set Management

```bash
# Create change set
aws cloudformation create-change-set --stack-name NAME --change-set-name CS_NAME --template-body file://t.yaml

# Describe change set
aws cloudformation describe-change-set --stack-name NAME --change-set-name CS_NAME

# Execute change set
aws cloudformation execute-change-set --stack-name NAME --change-set-name CS_NAME

# Delete change set
aws cloudformation delete-change-set --stack-name NAME --change-set-name CS_NAME

# List change sets
aws cloudformation list-change-sets --stack-name NAME
```

### Drift Detection

```bash
# Start drift detection
aws cloudformation detect-stack-drift --stack-name NAME

# Get drift detection status
aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id ID

# Get resource drift details
aws cloudformation describe-stack-resource-drifts --stack-name NAME
```

### StackSets

```bash
# Create stack set
aws cloudformation create-stack-set --stack-set-name NAME --template-body file://t.yaml

# Create stack instances
aws cloudformation create-stack-instances --stack-set-name NAME --accounts ACCOUNT_IDS --regions REGIONS

# Update stack set
aws cloudformation update-stack-set --stack-set-name NAME --template-body file://t.yaml

# Delete stack instances
aws cloudformation delete-stack-instances --stack-set-name NAME --accounts ACCOUNTS --regions REGIONS --no-retain-stacks

# Delete stack set
aws cloudformation delete-stack-set --stack-set-name NAME
```

### Useful Query Patterns

```bash
# Get stack status quickly
aws cloudformation describe-stacks --stack-name NAME --query "Stacks[0].StackStatus" --output text

# Get a specific output value
aws cloudformation describe-stacks --stack-name NAME \
    --query "Stacks[0].Outputs[?OutputKey=='WebServerURL'].OutputValue" \
    --output text

# Get all failed resources during a creation
aws cloudformation describe-stack-events --stack-name NAME \
    --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" \
    --output table
```

---

## 20. Interview Q&A

**Q1: What is the relationship between a CloudFormation template and a stack?**

A: A template is a YAML or JSON blueprint describing desired infrastructure. It is just a file — it creates nothing by itself. A stack is the live deployment created when you deploy a template. The stack tracks all the created resources (VPCs, instances, databases) as a managed unit. You can deploy the same template multiple times to create multiple independent stacks — for example, one stack per environment (dev, staging, prod) using different parameter values. Deleting a stack deletes all resources it manages (subject to DeletionPolicy).

---

**Q2: What is a Change Set and why is it critical for production?**

A: A Change Set is a preview of what CloudFormation will do before you execute an update — which resources will be added, modified, or deleted, and whether any modifications require resource replacement. It's critical for production because some changes trigger resource replacement (the old resource is deleted and a new one is created), which can cause data loss for databases or downtime for EC2 instances. Change Sets let you review these impacts and get approval before applying. They also integrate into CI/CD pipelines as manual approval gates.

---

**Q3: What happens when a CloudFormation stack creation fails?**

A: By default, CloudFormation automatically rolls back — it deletes all successfully created resources in reverse dependency order, and the stack ends in `ROLLBACK_COMPLETE` state. This is the safe default, ensuring you never have a partially-created stack in production. You can disable this with `--on-failure DO_NOTHING` (useful for debugging), which leaves the stack in `CREATE_FAILED` state with partial resources intact for inspection. With `--on-failure DELETE`, the stack is deleted even if creation fails.

---

**Q4: Explain DeletionPolicy: Snapshot vs Retain vs Delete.**

A: `Delete` (default) means the resource is deleted when the stack is deleted — appropriate for stateless resources. `Retain` means the resource is NOT deleted; it becomes an orphan that you must manage manually — good for S3 buckets with data or resources that other systems depend on. `Snapshot` creates a snapshot before deletion — critical for databases (RDS, ElastiCache, Redshift) where you want a recovery point even after the stack is gone. In production, all database resources should have both `DeletionPolicy: Snapshot` and `UpdateReplacePolicy: Snapshot`.

---

**Q5: What is the difference between Fn::Ref and Fn::GetAtt?**

A: `!Ref` returns the primary identifier of a resource — for a VPC it's the VPC ID, for an S3 bucket it's the bucket name, for an EC2 instance it's the instance ID. `!GetAtt` returns a specific secondary attribute. For example, `!GetAtt MyInstance.PublicIp` returns the public IP (not the instance ID), `!GetAtt MyRDS.Endpoint.Address` returns the database endpoint, and `!GetAtt MyALB.DNSName` returns the load balancer DNS name. `!GetAtt` is needed whenever you need an attribute other than the primary ID.

---

**Q6: What are CloudFormation StackSets and when would you use them?**

A: StackSets allow you to deploy a CloudFormation template to multiple AWS accounts and/or multiple regions simultaneously from a single operation. You'd use them for: deploying security baselines (IAM roles, Config rules, GuardDuty, CloudTrail) to all accounts in an AWS Organization; creating shared infrastructure in multiple regions for multi-region applications; or enforcing compliance configurations across accounts. StackSets support two permission models: self-managed (you create IAM roles in each account) and service-managed (uses AWS Organizations, with automatic deployment to new accounts).

---

**Q7: How do Nested Stacks differ from StackSets?**

A: Nested Stacks are about template modularity within a single deployment — breaking a large template into smaller, reusable modules (network, compute, database) deployed together as a parent-child hierarchy in one account and region. StackSets are about deploying the same infrastructure across multiple accounts and/or regions. Nested stacks reference each other and share outputs; stack set instances are independent in each account/region.

---

**Q8: What is CloudFormation Drift Detection and how do you respond to drift?**

A: Drift Detection compares the actual configuration of stack resources against what the CloudFormation template expects. Drift occurs when someone manually modifies a resource via the console, CLI, or other tools outside of CloudFormation. You initiate drift detection with `detect-stack-drift`, which is asynchronous. Results show each resource as `IN_SYNC`, `MODIFIED`, `DELETED`, or `NOT_CHECKED`. When you find drift, you should either: update the template to match the manual change (if the change was intentional), or update the resource back to match the template (if the change was unauthorized). Responding to drift is also a security practice — unexpected security group changes (like someone adding SSH access) should trigger immediate investigation.

---

**Q9: How would you pass values between stacks?**

A: Two approaches: (1) Cross-stack references using Outputs with `Export.Name` in the producing stack, and `Fn::ImportValue` in the consuming stack. This creates a hard dependency — you cannot delete the producing stack while it has active importers. (2) SSM Parameter Store — the producing stack writes values to SSM Parameters, and the consuming stack uses `AWS::SSM::Parameter::Value` type parameters or reads from SSM via custom resources. SSM approach avoids the hard dependency and is more flexible for complex patterns. For nested stacks, parent stacks can pass child stack outputs directly via `Fn::GetAtt NestedStack.Outputs.OutputName`.

---

**Q10: What are the benefits of using `AWS::SSM::Parameter::Value` as a parameter type?**

A: Using SSM Parameter Store integration allows templates to fetch the current value of an SSM parameter at deploy time instead of hardcoding values. Key benefits: (1) AMI IDs — AWS maintains the `/aws/service/ami-amazon-linux-latest/...` path and updates it automatically; your template always gets the latest AMI without template changes. (2) Shared configuration — store VPC IDs, certificate ARNs, or account-specific settings in SSM and reference them across templates without exporting/importing. (3) Secrets (SecureString) — use `AWS::SSM::Parameter::Value<String>` to inject sensitive values that aren't stored in the template file itself.

---

**Q11: What `--capabilities` flags does CloudFormation require and why?**

A: CloudFormation requires explicit capability acknowledgment when a template creates IAM resources, to prevent accidental privilege escalation. `CAPABILITY_IAM` is required when the template creates IAM roles or policies without custom names. `CAPABILITY_NAMED_IAM` is required when IAM resources have explicit custom names (more specific and therefore more powerful). `CAPABILITY_AUTO_EXPAND` is required when the template uses CloudFormation macros (like AWS SAM transforms). Without the correct capabilities, the `create-stack` or `update-stack` command fails with an `InsufficientCapabilitiesException`.

---

**Q12: How do you handle secrets (like database passwords) in CloudFormation?**

A: Never hardcode passwords in templates. Three approaches: (1) Use a `NoEcho: true` parameter — the value is provided at deploy time and never displayed in the console or API responses. Store the actual value in a secrets manager and pass it in via CI/CD pipeline environment variables. (2) Use AWS Secrets Manager — create the secret separately, then reference it: `!Sub "{{resolve:secretsmanager:${SecretArn}:SecretString:password}}"`. CloudFormation fetches the value at deploy time. (3) Use SSM Parameter Store SecureString — `!Sub "{{resolve:ssm-secure:MyDbPassword}}"`. Options 2 and 3 mean the actual secret value never appears in your template or parameter list.

---

**Q13: What is the purpose of Stack Policies?**

A: Stack Policies are IAM-style JSON documents that prevent specific resources within a stack from being updated or replaced during stack updates. They act as guardrails to prevent accidental modification of critical resources like production databases. By default (no policy), all resources can be updated. A Stack Policy can deny all updates to a specific resource (like a production RDS instance) or deny specific update actions (like `Update:Replace`). Unlike DeletionPolicy, Stack Policies protect during updates, not deletion. To update a protected resource, you must provide a temporary override policy during that specific update operation.

---

**Q14: Explain the Fn::Sub function with an example.**

A: `!Sub` performs string substitution. It replaces `${VariableName}` placeholders in a string with the corresponding values. Variables can be: (1) Parameters referenced by their logical name, (2) Resource attributes using `ResourceLogicalName.Attribute` syntax, (3) Pseudo parameters like `AWS::Region`. Example: `!Sub "${AWS::AccountId}-${AWS::Region}-${Environment}-logs"` becomes `"123456789012-ap-southeast-2-prod-logs"`. For complex substitutions, `!Sub` can take a two-element list where the second element is a map of custom variable substitutions. It's more powerful than `!Join` for most string building scenarios.

---

**Q15: What is the maximum size of a CloudFormation template and how do you work around it?**

A: The limits are: 51,200 bytes when passing via `--template-body` (direct upload), and 1 MB when stored in S3 and passed via `--template-url`. For templates exceeding 1 MB, use Nested Stacks — break the template into smaller logical modules (networking, compute, database), upload each to S3, and reference them from a root template using `Type: AWS::CloudFormation::Stack`. Nested templates can each be up to 1 MB, and nesting can go up to 200 levels deep. Other limits: 500 resources per template, 200 outputs, 200 parameters, 200 mappings, 200 conditions.

---

*End of CloudFormation Complete Guide*
