# Project 01 — S3 Resume Storage API

## Goal

Build a Node.js Express API that allows users to upload, download, list, and delete PDF resumes, storing and retrieving the files from a local emulated S3 bucket.

## What You'll Build

A RESTful backend service with endpoints (`POST /upload`, `GET /resumes`, `GET /download/:filename`, `DELETE /:filename`) that wraps the AWS SDK v3 `@aws-sdk/client-s3` library. The application will connect to the Floci container at port 4566 and manage a private S3 bucket called `user-resumes`.

## Phases Required

- Phase 1 — AWS Local Setup
- Phase 2 — Identity & Access Management (IAM)
- Phase 3 — Amazon S3 Storage

## Requirements

- **Local S3 Client configuration:** The client must be initialized targeting `http://localhost:4566`, using path-style addressing (`forcePathStyle: true`), and non-empty mock credentials.
- **Upload Endpoint (`POST /upload`):** Accepts file uploads via `multer` middleware, streams the binary buffer to S3 using the `PutObjectCommand`, and returns the S3 object key.
- **Download Endpoint (`GET /download/:filename`):** Retrieves the file binary from S3 using the `GetObjectCommand` and pipes the data stream back to the client browser.
- **Delete Endpoint (`DELETE /:filename`):** Deletes the object key from the local bucket using the `DeleteObjectCommand`.
- **Pre-signed URL:** Include a route `GET /presigned/:filename` that returns a download URL valid for 5 minutes.

## Suggested Approach

1. Configure your local AWS profile and start the Floci container.
2. Initialize a Node.js project, install `express`, `multer`, and `@aws-sdk/client-s3`.
3. Create the S3 client instance, setting `endpoint` and `forcePathStyle` to true.
4. Write a script to create the S3 bucket `user-resumes` using the AWS CLI or programmatically on startup.
5. Create the Express server and implement the file upload route using `multer.memoryStorage()`.
6. Implement the download and delete handlers, verifying S3 actions via the local console logs.
7. Implement the pre-signed URL generator using `getSignedUrl` from `@aws-sdk/s3-request-presigner`.

## Stretch Goals

- Add file size and format validation (allow only PDF files under 5MB).
- Configure versioning on your S3 bucket and return the active `VersionId` after uploading.
- Implement an audit log system that writes upload event JSON objects to a second S3 folder prefix.

## Evaluation Checklist

- [ ] S3 client is configured with local endpoint overrides.
- [ ] Uploading a PDF resume returns a `201 Created` status and S3 key mapping.
- [ ] Downloading a resume successfully retrieves the identical file binary.
- [ ] Deleting a file removes it from the local S3 bucket.
- [ ] Pre-signed URL endpoint returns a valid link that is fetchable via the browser.
