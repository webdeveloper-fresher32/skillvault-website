# Local AWS Cheatsheet

Unified reference material for local AWS development using Floci, Docker, AWS CLI, and Terraform.

---

### Floci CLI & Environment Overriding

Manage the local cloud via the native Floci CLI or manual shell environment exports.

```bash
# Install Floci CLI
brew install floci-io/floci/floci

# Start & manage Floci emulators
floci start
floci status
floci doctor

# Export local environment variables dynamically to the active shell
eval $(floci env)

# Manual S3 lookup (if not using floci env exports)
aws s3 ls --endpoint-url=http://localhost:4566
```

---

### AWS CLI Local Operations Sheet

| Task | Command |
|---|---|
| Configure Profile | `aws configure --profile local` (Use dummy credentials) |
| List S3 Buckets | `aws s3 ls` |
| Create S3 Bucket | `aws s3 mb s3://my-local-bucket` |
| Upload S3 Object | `aws s3 cp file.txt s3://my-local-bucket/folder/` |
| List IAM Users | `aws iam list-users` |
| Create IAM Role | `aws iam create-role --role-name my-role --assume-role-policy-document file://policy.json` |
| Create Dynamo Table | `aws dynamodb create-table --table-name my-table --attribute-definitions AttributeName=PK,AttributeType=S --key-schema AttributeName=PK,KeyType=HASH --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5` |
| List Dynamo Tables | `aws dynamodb list-tables` |
| Put Table Item | `aws dynamodb put-item --table-name my-table --item '{"PK": {"S": "USER#1"}}'` |
| Invoke Lambda | `aws lambda invoke --function-name my-func --payload '{"key": "val"}' --cli-binary-format raw-in-base64-out out.json` |
| List SQS Queues | `aws sqs list-queues` |
| Create SQS Queue | `aws sqs create-queue --queue-name my-queue` |
| Create SNS Topic | `aws sns create-topic --name my-topic` |
| Subscribe SQS to SNS | `aws sns subscribe --topic-arn <topic-arn> --protocol sqs --notification-endpoint <queue-arn>` |

---

### Node.js SDK Local Client Configuration

Always initialize SDK clients with local endpoint mappings and path-style overrides (for S3).

#### S3 Client Setup
```js
import { S3Client } from "@aws-sdk/client-s3";
const s3 = new S3Client({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  forcePathStyle: true, // Required for local path addressing
  credentials: { accessKeyId: "mock", secretAccessKey: "mock" }
});
```

#### DynamoDB Client Setup
```js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
const client = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "mock", secretAccessKey: "mock" }
});
const docClient = DynamoDBDocumentClient.from(client);
```

#### Lambda Client Setup
```js
import { LambdaClient } from "@aws-sdk/client-lambda";
const lambda = new LambdaClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566",
  credentials: { accessKeyId: "mock", secretAccessKey: "mock" }
});
```

---

### Docker Compose & Floci UI Console

Orchestrate both the Floci emulators and the visual resource browser dashboard (`floci-ui`) together on localhost.

```yaml
# docker-compose.yml
services:
  floci:
    image: flociorg/floci:latest
    container_name: local-aws-cloud
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,dynamodb,lambda,apigateway,sqs,sns,cloudwatch
    volumes:
      - "./floci-data:/tmp/floci/data"
      - "/var/run/docker.sock:/var/run/docker.sock"

  floci-ui:
    image: flociorg/floci-ui:latest
    container_name: local-cloud-dashboard
    ports:
      - "4500:4500"
    environment:
      - FLOCI_ENDPOINT=http://floci:4566
    depends_on:
      - floci
```

Access the visual dashboard at: `http://localhost:4500`

---

### Terraform Local Provider Override

Override endpoints inside your provider block to run local apply scripts.

```hcl
# main.tf
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "mock"
  secret_key                  = "mock"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    s3       = "http://localhost:4566"
    dynamodb = "http://localhost:4566"
    lambda   = "http://localhost:4566"
    iam      = "http://localhost:4566"
  }
}
```
