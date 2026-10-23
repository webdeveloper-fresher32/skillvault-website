# Phase 11: Testing

## What You'll Learn

Learn how to write reliable, maintainable tests for Angular applications. Cover unit testing components, services, and async code with Jasmine, Karma, and Angular's `TestBed`, then round out your test strategy with a modern end-to-end (e2e) testing approach using Playwright.

## Learning Objectives

- Write unit tests using Jasmine's `describe`/`it`/`expect` syntax and understand how Karma runs them
- Configure `TestBed` to test standalone components in isolation
- Mock dependencies with Jasmine spies (`createSpy`, `createSpyObj`)
- Test components that interact with the DOM and services that call `HttpClient`
- Understand the role of e2e testing and write a basic Playwright test against an Angular app

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Unit-Testing-Fundamentals.md](01-Unit-Testing-Fundamentals.md) | Jasmine syntax, Karma, TestBed, spies | 1 day |
| [02-Testing-Components-and-Services.md](02-Testing-Components-and-Services.md) | DOM testing, HttpClientTestingModule, async testing (fakeAsync/tick) | 1 day |
| [03-E2E-Testing-Basics.md](03-E2E-Testing-Basics.md) | Unit vs e2e, Playwright/Cypress, stable selectors | 1 day |

## Estimated Time

3 days

## Next Phase

→ [Phase 12: Performance and Deployment](../Phase-12-Performance-and-Deployment/README.md)
