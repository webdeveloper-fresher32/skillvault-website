# Project 1: Dockerizing a Monolith

In this project, you will take a simple, local monolithic application and package it as a Cloud-Native container using Docker.

## The Goal
Learn how to write a `Dockerfile`, build an image, and run a containerized application that relies on environment variables for configuration.

## Requirements

1. **The Application**: Create a simple web server (e.g., Express.js, Flask, or Spring Boot) that returns "Hello from the Monolith!" on port 3000.
2. **Configuration**: The application must read an environment variable called `MESSAGE_PREFIX`. If set, the output should be "[PREFIX] Hello from the Monolith!".
3. **The Dockerfile**: Write a `Dockerfile` that:
   - Uses a lightweight base image (e.g., `node:18-alpine` or `python:3.9-slim`).
   - Copies your application code into the image.
   - Installs dependencies.
   - Exposes port 3000.
   - Defines the startup command.
4. **Execution**: Build the image (`docker build -t my-monolith .`) and run it (`docker run -p 3000:3000 -e MESSAGE_PREFIX="PROD" my-monolith`).

## Why this matters
This proves you understand Factor #2 (Dependencies) and Factor #3 (Config in the Environment) of the 12-Factor App methodology. You have made the application portable and cloud-ready.
