# Local AWS & DevOps Interview Q&A

50 questions covering local AWS development, core serverless services, Docker simulation, Terraform, and local DevOps pipelines.

---

## AWS Local Fundamentals & Architecture (Q1–Q8)

### Q1. What is a local cloud emulator, and why is it useful during development?
A local cloud emulator is a software wrapper (like Floci) that runs inside Docker on your host machine, mocking AWS service API endpoints on localhost. It is useful because it allows developers to write and test code using real AWS SDKs and CLI commands without internet latency, connection requirements, or live billing fees.

### Q2. How do AWS client SDKs target a local cloud emulator?
They target the emulator via "endpoint overriding." During client initialization, the developer passes a custom URL (e.g. `endpoint: "http://localhost:4566"`) to the SDK config block, redirecting API HTTP requests away from default AWS domains to localhost.

### Q3. Why do local emulators default to port 4566?
Port `4566` is the standard port mapped to the single edge proxy router inside local AWS emulation containers. This proxy intercepts incoming HTTP requests on a single port and routes them internally to mock handlers (S3, DynamoDB, etc.) based on URL paths and headers.

### Q4. Do you need valid AWS access keys to access local emulators?
No. Local emulators bypass cryptographic signature checks and trust incoming request profiles. However, AWS SDKs and CLI binaries require non-empty dummy strings (e.g., `accessKeyId: "mock"`) to pass client-side configuration validation.

### Q5. What is the default AWS account ID used in local emulators, and why does it matter?
The default account ID is `000000000000`. This matters because resource ARNs (like IAM roles or SQS queues) use this ID. When deploying configurations to live AWS, you must replace `000000000000` with your real 12-digit AWS account ID.

### Q6. What under-the-hood technology allows Floci to have a much lower memory footprint than LocalStack?
Floci is written in Java and compiled directly to a platform-native executable using GraalVM and the Quarkus Native framework. This Native compilation bypasses standard JVM and Python interpreter overhead, enabling the container to boot in ~24ms and consume only ~13 MiB of idle RAM, compared to LocalStack's Python engine which consumes over 1 GB of idle RAM.

### Q7. What is `floci-ui`, and how do you connect it to your local emulators?
`floci-ui` is a web-based console dashboard that connects to running Floci instances (via HTTP API endpoints on port 4566). It provides a visual UI interface to browse created S3 buckets, files, DynamoDB tables, SQS queues, and execution logs locally, similar to the AWS Web Console.

### Q8. What is the main security difference when running APIs against local emulators?
Local emulators do not enforce strict IAM permission policies on operations by default to speed up prototyping. A client with dummy credentials can call S3 and DynamoDB without explicit policy grants, whereas live AWS denies all requests by default.

---

## Local S3 Storage & DynamoDB Database (Q9–Q16)

### Q9. Why must you configure `forcePathStyle: true` for S3 clients locally?
By default, S3 SDKs use virtual-hosted-style URLs (`http://bucket.s3.amazonaws.com`). Locally, DNS engines cannot resolve wildcards like `*.localhost` to your container out of the box. Forcing path-style converts URLs to `http://localhost:4566/bucket`, which resolves instantly.

### Q10. What is an S3 pre-signed URL, and what is its primary use case?
A pre-signed URL is a temporary URL containing cryptographic credentials. It grants clients (like web browsers) access to upload or download a specific object directly to S3 within an expiration window, avoiding routing files through your API server.

### Q11. How do you host a static website using S3 locally?
You upload your web assets (`index.html`, CSS, JS) to a local S3 bucket, configure the bucket for static hosting via the CLI `aws s3 website` command, and access the assets using the local path URL `http://localhost:4566/my-bucket/index.html`.

### Q12. How does DynamoDB Partition Key (PK) routing differ from Sort Key (SK) routing?
The Partition Key is hashed to determine the physical database storage partition holding the item. The Sort Key is used to physically sort items within that partition, allowing range query filters (like `begins_with` or `between`) on record collections.

### Q13. Why should you avoid using Scan operations in DynamoDB?
A `Scan` reads every single item sequentially across the entire table, consuming massive read capacity (RCUs) and slowing down performance as the table grows. A `Query` targets only the partition matching the PK, which is highly efficient.

### Q14. What is a Global Secondary Index (GSI) in DynamoDB, and when is it used?
A GSI is an alternate index that allows you to query a table using a different partition key and sort key than the primary keys. It is used to satisfy query patterns that do not fit the main table's partition key schema.

### Q15. How does the DynamoDB Document Client simplify Node.js code?
The raw DynamoDB client expects attributes formatted with type descriptors (e.g. `{ name: { S: "Alice" } }`). The Document Client automatically marshals standard JavaScript objects to DynamoDB format during writes, and unmarshals them back during reads.

### Q16. How does Time to Live (TTL) work in DynamoDB, and why is it useful?
TTL automatically deletes items after an epoch timestamp attribute has passed. DynamoDB cleans up expired records in the background, helping manage storage sizes and prune stale sessions without cron scripts.

---

## Serverless: Lambda & API Gateway (Q17–Q25)

### Q17. How does a local emulator execute Lambda functions?
It connects to the host's Docker daemon via mapped `/var/run/docker.sock`. When a function is invoked, the emulator dynamically pulls the matching official AWS Lambda base image, starts it as a sibling container, mounts the function code, and returns the handler response.

### Q18. Why does S3 or DynamoDB code running inside a local Lambda function fail when pointing to `localhost`?
Because the Lambda function executes inside a sibling container on the Docker network. Inside that container, `localhost` resolves to itself, not the host machine where Floci port 4566 is exposed. The SDK must use `http://host.docker.internal:4566`.

### Q19. What is a Lambda Layer, and what is its benefit?
A Lambda Layer is a zip archive containing shared code libraries, dependencies, or custom runtimes. It allows you to share package dependencies across multiple functions, reducing deployment zip sizes and speeding up compile times.

### Q20. What is a serverless cold start, and when does it occur?
A cold start is the instantiation delay that occurs when a Lambda function is invoked after a period of inactivity or when scaling up. AWS must spin up a new container runtime environment and load the function code before executing the handler.

### Q21. How do you configure Lambda env vars and timeout limits locally?
You declare `--environment` key-value maps and specify the `--timeout` parameter (in seconds) during function creation using the CLI. Sibling Docker run containers inherit these parameters, terminating execution if they time out locally.

### Q22. What is Lambda Proxy Integration (`AWS_PROXY`) in API Gateway?
It is an integration model where API Gateway passes the raw HTTP request (headers, query parameters, body) directly to the Lambda function as a JSON object, letting the Lambda handle all routing and response header configurations.

### Q23. Why must Lambda functions return a structured JSON object when using proxy integrations?
Because API Gateway expects a specific return schema to format the HTTP response. The Lambda must return a JSON object containing `statusCode` (integer), `headers` (object), and `body` (stringified JSON) fields.

### Q24. How does API Gateway handle CORS preflight requests?
The browser sends an `OPTIONS` request before making cross-origin requests. API Gateway must be configured to intercept `OPTIONS` calls and return appropriate Access-Control headers, allowing the browser to proceed with the main request.

### Q25. Why must you create a "Deployment" and a "Stage" in API Gateway?
API Gateway separates route configurations from execution runtimes. Creating resources edits the metadata but doesn't affect active URLs. A Deployment pushes a snapshot of the config to a specific Stage (like `dev` or `prod`), making endpoints live.

---

## SQS & SNS Messaging (Q26–Q32)

### Q26. What is the difference between message queues (SQS) and pub-sub topics (SNS)?
SQS is a pull-based queuing service where messages are buffered and retrieved by competing workers (one consumer per message). SNS is a push-based pub-sub broadcasting service that sends messages instantly to all subscribed endpoints.

### Q27. What is the SQS Visibility Timeout, and what happens if a worker fails to delete a message?
It is the period SQS hides a message from other pollers after a worker retrieves it. If the worker fails to process the message and call `DeleteMessage` before the timeout expires, the message becomes visible again, allowing retries.

### Q28. What is the SQS/SNS "fan-out" pattern?
It is an architectural pattern where a single message published to an SNS topic is automatically duplicated and pushed to multiple subscribed SQS queues, enabling decoupled parallel processing by independent services.

### Q29. What is a Dead-Letter Queue (DLQ) in SQS?
A DLQ is an SQS queue used to hold messages that fail processing after a configured number of retries (Redrive Policy). It isolates poison-pill payloads for manual inspection without blocking the primary queue.

### Q30. How do SQS FIFO queues guarantee ordering and prevent duplicate processing?
FIFO (First-In-First-Out) queues use Message Group IDs to process messages in strict sequential order. They use Message Deduplication IDs to automatically discard duplicate messages sent within a 5-minute deduplication window.

### Q31. How does polling work in SQS, and what is the difference between Short Polling and Long Polling?
Short polling queries a subset of SQS servers and returns immediately, even if no messages are found (high API calls). Long polling (`WaitTimeSeconds > 0`) waits up to 20 seconds for a message to arrive before responding, reducing empty requests.

### Q32. How do you configure a local SQS queue to trigger a local Lambda function?
You create the queue and the Lambda function, then register an Event Source Mapping (`aws lambda create-event-source-mapping`). Floci polls the queue under the hood and triggers the Lambda sibling container when messages arrive.

---

## Docker & EC2 Simulation (Q33–Q38)

### Q33. Why is Docker used to simulate EC2 instances during local development?
Because full VM hypervisors are resource-heavy to run locally. Docker containers share the host machine's kernel, launching an isolated OS environment (like Ubuntu) in seconds, allowing developers to test Linux administration scripts for free.

### Q34. How do you simulate SSH access to a local EC2 mock container?
You install an SSH server (`openssh-server`) inside your Dockerfile, configure authorized public keys in `/root/.ssh/authorized_keys`, map container port 22 to host port 2222, and run `ssh -p 2222 root@localhost` in your host terminal.

### Q35. Why does `systemctl` fail inside standard Docker containers?
Because standard containers do not run a full init daemon (like `systemd`) as PID 1 to keep images lightweight. To start background services (like Nginx), you must execute their binaries directly or use the `service` utility wrapper.

### Q36. What is a reverse proxy, and why is Nginx placed in front of Node.js apps?
A reverse proxy sits in front of backend servers, routing client requests to them. Nginx is placed in front of Node.js to handle SSL decryption, compress assets, cache responses, rate-limit clients, and serve static frontend files efficiently.

### Q37. What is the role of PM2 in node deployments?
PM2 is a production process manager for Node.js. It runs applications in the background, automatically restarts them if they crash, aggregates console logs, and manages clusters to utilize multiple CPU cores.

### Q38. How are security groups simulated in local container networks?
They are simulated by configuring Docker port mapping parameters. By exposing only specific ports (e.g. `-p 8080:80`) to the host, you simulate inbound firewall rules, leaving unmapped ports isolated within the Docker bridge network.

---

## Terraform IaC Local (Q39–Q44)

### Q39. What is Infrastructure as Code (IaC), and what is its main benefit?
IaC is the practice of managing and provisioning cloud infrastructure using declarative configuration files (like Terraform's HCL). The benefits include version control, reproducibility across environments, and avoiding human error.

### Q40. How do you configure Terraform to target local Floci endpoints?
Inside the `provider "aws"` block, you define the `endpoints` configuration object, mapping service keys (like `s3` or `dynamodb`) to `http://localhost:4566`. You also skip credentials, account, and metadata checks.

### Q41. What is the purpose of the `terraform init` command?
It initializes the working directory, parsing your configuration files and downloading the required provider plugins (like the HashiCorp AWS provider) from the registry into a local cache directory (`.terraform/`).

### Q42. What is the difference between `terraform plan` and `terraform apply`?
`terraform plan` is a read-only dry-run that compares HCL declarations to the state file and running resources, detailing the additions, changes, and destructions. `terraform apply` executes the plan, making API calls to provision the resources.

### Q43. What is the role of the `terraform.tfstate` file, and why must it be git-ignored?
The state file stores the mapping between your HCL resource declarations and the real-world resources created in the cloud. It contains sensitive configuration metadata and plaintext secrets, and should be git-ignored to prevent security leaks.

### Q44. How does Terraform handle resource dependencies during execution?
It constructs a Directed Acyclic Graph (DAG) based on resource references (e.g. `bucket = aws_s3_bucket.my_bucket.id`). It creates independent resources in parallel and dependent resources sequentially, reversing the order during destruction.

---

## ECS, Observability, and AI Simulation (Q45–Q50)

### Q45. How do you simulate Amazon ECR (Elastic Container Registry) locally?
You launch a local Docker Registry container (`registry:2`) on port 5001. In your workspace, you build your app image, tag it using the prefix `localhost:5001/image-name:tag`, and run `docker push` to upload it to the local registry container.

### Q46. What is an ECS Task Definition JSON file?
It is a JSON file that describes the container configuration for your application (the image URL, memory limits, CPU shares, environment variables, log configurations, and port mappings) used by ECS to run tasks.

### Q47. How does the AWS SAM CLI simplify local serverless testing?
The SAM CLI reads a YAML template file declaring serverless resources. Running `sam local invoke` mounts your function code into a transient Docker container matching the official Lambda runtime, executes it, and returns outputs immediately.

### Q48. What is the difference between CloudWatch Log Groups and Log Streams?
A Log Group is a logical container that shares retention and monitoring policies (e.g. `/aws/lambda/my-func`). A Log Stream is a sequence of log events originating from a specific running instance of a container or host.

### Q49. How do you simulate Amazon Bedrock API calls locally for free?
You install Ollama to run models (like Llama 3) locally on port 11434. In your code, you use LangChain's `ChatOllama` wrapper during development. Swapping to `ChatBedrock` in production requires minimal configuration changes.

### Q50. How is AWS SageMaker Inference emulated locally using Python and FastAPI?
You build a FastAPI server exposing GET `/ping` (for container health checks) and POST `/invocations` (to receive payloads and return predictions). You containerize this app and run it on port 8080, matching SageMaker's container API schema.
