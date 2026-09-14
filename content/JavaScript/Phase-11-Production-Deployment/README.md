# Phase 11: Production & Deployment

## What You'll Learn

Writing code that works on your laptop is the easy part — shipping it as a reliable, observable, maintainable production service is where professional engineering happens. This final phase covers everything between "it works locally" and "it runs safely in production": testing with Jest so regressions get caught automatically, debugging techniques for when something inevitably goes wrong, structured logging so you can understand production behavior after the fact, environment-based configuration so the same code runs correctly across dev/staging/production, and CI/CD pipelines that automatically test and deploy your code. By the end of this phase you will be able to take a Node.js application from a local prototype to a deployed, monitored, production-grade service.

## Learning Objectives

- Write unit and integration tests with Jest, including mocking dependencies and testing asynchronous code
- Debug a running Node process using `--inspect` and Chrome DevTools, and use console methods beyond `console.log`
- Design custom Error classes and a centralized error-handling strategy
- Implement structured logging with levels (debug/info/warn/error) using a library like Winston or Pino
- Manage configuration safely across environments with validated `.env` files
- Understand the pitfalls of `process.env` (stringly-typed values, missing-variable silence)
- Build a CI/CD pipeline for a Node app using GitHub Actions
- Compare deployment targets — Vercel, Render, and PM2 on a VPS — and choose appropriately
- Implement health checks and understand what zero-downtime deployment requires
- Apply a production readiness checklist before shipping

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Testing-and-Debugging.md](01-Testing-and-Debugging.md) | Jest fundamentals (describe/it/expect), mocking with jest.fn/jest.mock, testing async code, Node debugging with --inspect, console.table/time/trace, custom Error classes, centralized error handling | 3 days |
| [02-Logging-and-Environment-Config.md](02-Logging-and-Environment-Config.md) | Structured logging concepts (Winston/Pino), log levels, environment-based config per environment, config validation, process.env pitfalls | 2 days |
| [03-CICD-and-Deployment.md](03-CICD-and-Deployment.md) | CI/CD pipeline concepts, GitHub Actions workflow example, Vercel/Render/PM2 deployment targets, health checks, zero-downtime deployment, production checklist | 3 days |

## Estimated Time

7–9 days

## Previous Phase

← [Phase 10: Backend JavaScript](../Phase-10-Backend-JavaScript/README.md)

## Next Steps

This is the final phase of the JavaScript course. From here:

→ [Projects](../Projects/README.md) — apply everything you've learned in progressively larger hands-on builds

→ [Quick-Reference](../Quick-Reference/README.md) — cheatsheet and interview Q&A for review before interviews
