# Project 03 — Image Processing Lambda

## Goal

Build an event-driven media pipeline where uploading an image to an S3 source bucket automatically triggers a Lambda function to resize the image and save a thumbnail back to a destination bucket.

## What You'll Build

A serverless processing chain running locally inside your Docker environment. It consists of:
- A source S3 bucket `original-images-bucket`.
- A destination S3 bucket `thumbnails-bucket`.
- A Node.js Lambda function `resize-image-fn` triggered by S3 `s3:ObjectCreated:*` events. The function downloads the image, resizes it using the `jimp` or `sharp` package, and uploads it.

## Phases Required

- Phase 3 — Amazon S3 Storage
- Phase 5 — AWS Lambda
- Phase 11 — DevOps & SAM CLI

## Requirements

- **Local trigger link:** The source S3 bucket must be configured with an event notification configuration that publishes to your Lambda function when new files arrive.
- **Dependency bundling:** Since the Lambda function uses an external image processing library (like `jimp` or `sharp`), you must bundle `node_modules` inside the deployed zip or use a Lambda Layer.
- **SDK Endpoint Resolution:** The Lambda function must download the original file using `GetObjectCommand` and write the resized binary using `PutObjectCommand`, targeting the host container endpoint (`http://host.docker.internal:4566`).

## Suggested Approach

1. Start the Floci container, and create the two S3 buckets using the CLI.
2. Initialize a Node.js project and install `jimp` (a pure JS image library, which avoids binary compilation issues on macOS/M4 compared to `sharp`).
3. Write the handler code: read the S3 bucket name and key from the event object, fetch the file, resize it to `150x150` pixels, and write the output.
4. Package the handler script and the `node_modules` directory into a zip file.
5. Deploy the function to the local container.
6. Create the S3-to-Lambda notification configuration mapping.
7. Upload a sample image to the source bucket using the CLI and verify the resized thumbnail appears in the destination bucket.

## Stretch Goals

- Add metadata logs to a local DynamoDB table for every processed file.
- Handle processing errors gracefully by sending failed event logs to an SQS Dead-Letter Queue.
- Extract image dimensions and EXIF metadata and write it as custom metadata headers on the S3 thumbnail object.

## Evaluation Checklist

- [ ] S3 buckets exist and can be listed locally.
- [ ] Lambda function runs with dependencies packaged successfully.
- [ ] Uploading a file triggers a sibling Docker container run for the Lambda.
- [ ] S3 event notification executes without loop issues.
- [ ] Mapped thumbnail is present in the destination bucket with dimensions modified.
