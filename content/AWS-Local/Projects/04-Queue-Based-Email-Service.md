# Project 04 — Queue-Based Email Service

## Goal

Design a decoupled, asynchronous notification pipeline where an API endpoint receives email requests, pushes them into a message queue, and triggers a background Lambda function to process the queue and mock dispatch the emails.

## What You'll Build

A decoupled microservice architecture:
- An Express Web API acting as the entry point, exposing `POST /send-email`.
- An SQS Queue `email-dispatch-queue` acting as a message buffer.
- An SNS Topic `email-events-topic` used to publish notifications (fan-out).
- A Lambda worker function `email-consumer` linked to the SQS queue, printing logs and simulating SMTP dispatches.

## Phases Required

- Phase 5 — AWS Lambda
- Phase 7 — SQS & SNS Messaging
- Phase 11 — DevOps & SAM CLI

## Requirements

- **API Publisher:** The Express route receives request payloads (`{ "to": "...", "subject": "...", "body": "..." }`) and publishes them to the SQS queue using `SendMessageCommand`.
- **Visibility Deduplication:** The worker Lambda receives SQS messages, processes them, and deletes them from the queue using `DeleteMessageCommand`.
- **Event Fan-out:** On successful email dispatch, the Lambda publishes an event JSON to the SNS topic `email-events-topic` so that downstream logging queues or analytics tasks receive the event metadata.

## Suggested Approach

1. Create the SQS queue and the SNS topic locally using the CLI.
2. Build the Express web application, integrating `@aws-sdk/client-sqs` to push email objects.
3. Write the consumer Lambda function handler (`app.mjs`) to read message bodies.
4. Implement the SQS event source mapping (`aws lambda create-event-source-mapping`) to automatically trigger the Lambda when messages arrive in the SQS queue.
5. Inside the Lambda code, utilize `@aws-sdk/client-sns` to publish to the topic on success.
6. Start the API server, submit a POST request, and monitor the container terminal logs.
7. Verify that SQS messages are cleared after the Lambda consumer finishes processing.

## Stretch Goals

- Configure a Dead-Letter Queue (DLQ) for SQS, set the max receive count to 3, throw a mock error in Lambda, and verify the failed email payload lands in the DLQ.
- Implement message deduplication using FIFO queues to prevent sending double emails for duplicate API calls.
- Add an email subscription SQS queue to the SNS topic to catalog sent message metrics.

## Evaluation Checklist

- [ ] SQS Queue and SNS Topic are active on port 4566.
- [ ] API successfully enqueues messages and returns `202 Accepted`.
- [ ] SQS queue automatically triggers the consumer Lambda.
- [ ] Consumer deletes messages from the queue on success.
- [ ] Analytics SQS queue receives copy from SNS fan-out topic.
