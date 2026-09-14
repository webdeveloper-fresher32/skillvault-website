# Logging Drivers — Complete Guide

## Table of Contents
1. [How Docker Logging Works](#1-how-docker-logging-works)
2. [Available Logging Drivers](#2-available-logging-drivers)
3. [The json-file Driver (Default)](#3-the-json-file-driver-default)
4. [The syslog Driver](#4-the-syslog-driver)
5. [The fluentd Driver](#5-the-fluentd-driver)
6. [The awslogs Driver](#6-the-awslogs-driver)
7. [Reading Logs with docker logs](#7-reading-logs-with-docker-logs)
8. [Daemon-Level vs Container-Level Configuration](#8-daemon-level-vs-container-level-configuration)
9. [Hands-On Exercises](#9-hands-on-exercises)
10. [Interview Q&A](#10-interview-qa)

---

## 1. How Docker Logging Works

Docker captures everything a container writes to **stdout and stderr** and routes it through a pluggable logging driver. The application itself does not need any logging library — just write to standard streams.

```
┌────────────────────────────────────────────────────────────┐
│  Container                                                 │
│                                                            │
│  Application  ──▶  stdout / stderr                        │
│                           │                               │
└───────────────────────────┼───────────────────────────────┘
                            │
                            ▼
                   Docker Logging Driver
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
     json-file           syslog          fluentd / awslogs
  (local disk)      (OS log daemon)    (external aggregator)
```

Key principle: logs go to stdout/stderr → Docker intercepts them → routes via the configured driver. Writing logs to files inside a container bypasses Docker's logging entirely and requires a separate strategy (volume mount or sidecar).

---

## 2. Available Logging Drivers

| Driver | Description | Use Case |
|--------|-------------|----------|
| `json-file` | Default. Writes JSON to local disk | Development, simple setups |
| `local` | Compressed binary format, local disk | Lower disk usage than json-file |
| `syslog` | Routes to syslog / journald | Linux hosts, systemd environments |
| `journald` | Sends to systemd journal | SystemD-based Linux hosts |
| `fluentd` | Sends to Fluentd/Fluent Bit daemon | Centralized log pipelines |
| `awslogs` | Sends to AWS CloudWatch Logs | AWS-hosted workloads |
| `gelf` | Graylog Extended Log Format | Graylog stacks |
| `splunk` | Sends to Splunk HTTP Event Collector | Splunk environments |
| `etwlogs` | Event Tracing for Windows | Windows containers |
| `none` | Discards all logs | Containers that should not log |

---

## 3. The json-file Driver (Default)

Docker writes each log line as a JSON object to a file on the host.

```
Log file location:
  /var/lib/docker/containers/<container-id>/<container-id>-json.log

Each line is:
  {"log":"2024-01-15T10:23:01Z INFO  Request received\n","stream":"stdout","time":"2024-01-15T10:23:01.123456789Z"}
```

### Configuring json-file Options

```bash
# Set per-container log rotation
docker run -d \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  nginx

# Options:
#   max-size   = rotate when file reaches this size (k, m, g)
#   max-file   = maximum number of rotated log files to keep
#   compress   = gzip rotated files (default: disabled)
#   labels     = comma-separated list of container labels to include in log record
#   env        = comma-separated list of env vars to include in log record
```

Without `max-size`, log files grow unbounded and can fill the disk in production.

### Daemon-wide json-file Config

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3",
    "compress": "true"
  }
}
```

---

## 4. The syslog Driver

Routes container logs to the host's syslog daemon (rsyslog, syslog-ng) or a remote syslog server.

```bash
# Send logs to local syslog
docker run -d \
  --log-driver=syslog \
  --log-opt syslog-address=unixgram:///dev/log \
  --log-opt tag="myapp/{{.Name}}" \
  myapp:latest

# Send logs to a remote syslog server over UDP
docker run -d \
  --log-driver=syslog \
  --log-opt syslog-address=udp://192.168.1.10:514 \
  --log-opt syslog-facility=daemon \
  --log-opt tag="myapp" \
  myapp:latest

# Send over TLS-encrypted TCP
docker run -d \
  --log-driver=syslog \
  --log-opt syslog-address=tcp+tls://logs.example.com:6514 \
  --log-opt syslog-tls-ca-cert=/etc/ssl/certs/ca.pem \
  myapp:latest
```

### syslog-address Schemes

```
unix:///path/to/socket    → Unix domain socket (local)
unixgram:///dev/log       → UDP-style Unix socket (local, common on Linux)
udp://host:port           → UDP (no delivery guarantee)
tcp://host:port           → TCP (reliable, unencrypted)
tcp+tls://host:port       → TLS-encrypted TCP
```

---

## 5. The fluentd Driver

Sends logs to a running Fluentd or Fluent Bit daemon, which can then route them to Elasticsearch, S3, BigQuery, Splunk, etc.

```
┌───────────────┐          ┌──────────────────┐          ┌──────────────┐
│   Container   │  TCP     │     Fluentd       │  HTTP    │Elasticsearch │
│  (app logs)   │ ────────▶│  (log router)     │ ────────▶│   / S3 / GCS │
└───────────────┘  24224   │                  │          └──────────────┘
                           │  filter, parse,  │
                           │  enrich, buffer  │
                           └──────────────────┘
```

```bash
# Send logs to local Fluentd daemon
docker run -d \
  --log-driver=fluentd \
  --log-opt fluentd-address=localhost:24224 \
  --log-opt tag="docker.{{.Name}}" \
  --log-opt fluentd-async=true \
  myapp:latest

# Key options:
#   fluentd-address   = host:port of Fluentd (default localhost:24224)
#   tag               = Fluentd tag (supports Go template {{.Name}}, {{.ID}})
#   fluentd-async     = don't block container if Fluentd is unavailable
#   fluentd-buffer-limit = in-memory buffer size when Fluentd is down
```

### Example: Fluent Bit Config to Forward to Elasticsearch

```ini
# fluent-bit.conf
[INPUT]
    Name    forward
    Listen  0.0.0.0
    Port    24224

[OUTPUT]
    Name    es
    Match   docker.*
    Host    elasticsearch
    Port    9200
    Index   docker-logs
    Type    _doc
```

---

## 6. The awslogs Driver

Sends logs directly to AWS CloudWatch Logs. No sidecar or agent needed — Docker writes to CloudWatch via the AWS API.

```bash
# Basic CloudWatch logging
docker run -d \
  --log-driver=awslogs \
  --log-opt awslogs-region=ap-southeast-2 \
  --log-opt awslogs-group=/myapp/production \
  --log-opt awslogs-stream=web-01 \
  myapp:latest

# Auto-create the log group if it doesn't exist
docker run -d \
  --log-driver=awslogs \
  --log-opt awslogs-region=ap-southeast-2 \
  --log-opt awslogs-group=/myapp/production \
  --log-opt awslogs-stream=$(hostname) \
  --log-opt awslogs-create-group=true \
  myapp:latest
```

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams"
    ],
    "Resource": "arn:aws:logs:*:*:*"
  }]
}
```

Note: When using `awslogs`, `docker logs` does NOT work — logs only exist in CloudWatch. Use the AWS Console or `aws logs get-log-events` to read them.

---

## 7. Reading Logs with docker logs

`docker logs` only works with drivers that support the **local log reader**: `json-file`, `local`, and `journald`. With `syslog`, `fluentd`, or `awslogs`, `docker logs` returns an error.

```bash
# Show all logs for a container
docker logs my-container

# Follow (tail -f equivalent)
docker logs -f my-container
docker logs --follow my-container

# Last N lines
docker logs --tail 100 my-container

# Since a timestamp
docker logs --since 2024-01-15T10:00:00 my-container

# Until a timestamp
docker logs --until 2024-01-15T11:00:00 my-container

# Show timestamps in output
docker logs -t my-container
docker logs --timestamps my-container

# Combine: last 50 lines with timestamps, follow
docker logs --tail 50 -t -f my-container

# Show only stderr
docker logs my-container 2>&1 1>/dev/null

# Filter logs with grep
docker logs my-container 2>&1 | grep ERROR
```

---

## 8. Daemon-Level vs Container-Level Configuration

```
Priority: container --log-driver flag > daemon.json default

┌──────────────────────────────────────────────────────┐
│  /etc/docker/daemon.json  (applies to ALL containers) │
│                                                        │
│  {                                                     │
│    "log-driver": "json-file",                         │
│    "log-opts": {                                       │
│      "max-size": "10m",                               │
│      "max-file": "3"                                  │
│    }                                                   │
│  }                                                     │
└──────────────────────────────────────────────────────┘
         │
         │  overridden per-container by:
         ▼
docker run --log-driver=awslogs --log-opt awslogs-group=/prod/web  ...
```

```bash
# Check which logging driver a container is using
docker inspect my-container --format '{{.HostConfig.LogConfig.Type}}'

# Check the effective log options
docker inspect my-container --format '{{json .HostConfig.LogConfig}}'
```

---

## 9. Hands-On Exercises

**Exercise 1:** Run an nginx container with `--log-driver=json-file --log-opt max-size=1m --log-opt max-file=2`. Generate some traffic with `curl localhost:<port>` a few times. Find the log file under `/var/lib/docker/containers/` and inspect its JSON structure.

**Exercise 2:** Run a container with `--log-driver=none`. Try `docker logs <id>` and observe the error message. This demonstrates how some drivers disable local log access.

**Exercise 3:** Run a container and use `docker logs --tail 20 -t -f <id>` to follow its output. In another terminal, exec into the container and run a command that produces stdout. Confirm the output appears in the followed log stream.

**Exercise 4:** Set a daemon-level log rotation in `/etc/docker/daemon.json` (or Docker Desktop equivalent). Restart Docker and start a new container without specifying `--log-driver`. Confirm with `docker inspect` that the daemon default was inherited.

**Exercise 5:** Start a Fluentd container (`docker run -d -p 24224:24224 fluent/fluentd`) and run a second container using `--log-driver=fluentd --log-opt fluentd-address=localhost:24224`. Generate logs in the second container and confirm Fluentd received them by checking its stdout with `docker logs <fluentd-id>`.

---

## 10. Interview Q&A

**Q: What is the default Docker logging driver and what are its limitations?**
Answer: The default driver is `json-file`. It writes log lines as JSON objects to `/var/lib/docker/containers/<id>/<id>-json.log` on the host. Its main limitations are: no log rotation by default (files grow unbounded), logs are stored only locally (no centralised aggregation), and on high-throughput containers it can cause significant I/O pressure. Always configure `max-size` and `max-file` options in production.

**Q: Why can't you use docker logs with the awslogs or fluentd driver?**
Answer: `docker logs` reads from the local log cache maintained by the `json-file`, `local`, and `journald` drivers. Drivers like `awslogs`, `syslog`, and `fluentd` are send-only — they forward logs to an external system and do not maintain a local copy. When you run `docker logs` against a container using one of these drivers, Docker returns an error stating the driver does not support reading. You must query the external system (CloudWatch, syslog, Fluentd) directly.

**Q: How would you centralise logs from 50 Docker containers running on multiple hosts?**
Answer: Use a log shipping driver such as `fluentd` or `awslogs` so all containers forward logs without local disk dependency. Run a Fluent Bit DaemonSet (or sidecar) on each host to collect and buffer logs, then forward to a centralised store like Elasticsearch, OpenSearch, or CloudWatch. Tag logs with container name, host, and environment labels. Set daemon-level driver config in `/etc/docker/daemon.json` so every container on each host inherits the same driver without per-run flags.

**Q: What is the difference between --log-opt fluentd-async=true and the default synchronous mode?**
Answer: In synchronous mode (default), Docker blocks the container's log write until Fluentd acknowledges receipt. If Fluentd is unavailable, the container can stall or fail to start. With `fluentd-async=true`, Docker buffers log messages in memory and retries in the background, so the container continues running even when Fluentd is temporarily down. The trade-off is potential log loss if the container crashes while messages are still in the buffer.

**Q: How do you rotate Docker log files in production?**
Answer: Two approaches. First, configure the `json-file` driver options: `--log-opt max-size=10m --log-opt max-file=5` (or set these in `/etc/docker/daemon.json`). Docker handles rotation automatically — when the file reaches `max-size`, it renames it and starts a new file, keeping at most `max-file` rotated copies. Second, use an external logging driver (`fluentd`, `awslogs`) to avoid local log files entirely, delegating retention and rotation to the external system.
