# Phase 10: Testing

## What You'll Learn

NestJS is built for testability from the ground up — the same dependency injection container that wires your application together in production lets you swap real providers for mocks in tests without touching your source code. This phase covers the full testing pyramid as Nest intends it: fast, isolated unit tests built on `Test.createTestingModule()` and Jest mocks; focused tests of controllers, guards, and pipes that avoid spinning up an HTTP server; and full end-to-end tests that boot a real Nest application and drive it with Supertest over actual HTTP requests, including a real or Testcontainers-backed database. By the end of this phase you'll know which layer of the pyramid a given piece of logic belongs in, and how to write tests at each layer that are fast, deterministic, and resistant to refactoring.

## Learning Objectives

- Understand Nest's default Jest configuration and project layout (`*.spec.ts` for unit tests, `test/*.e2e-spec.ts` for e2e tests)
- Use `Test.createTestingModule()` to build an isolated DI container scoped to a single test file
- Override providers with `overrideProvider().useValue()` to inject mocks and stubs in place of real dependencies
- Write `jest.fn()` mocks and use `jest.mock()` to stub out entire modules
- Unit-test a service in isolation with a mocked repository dependency
- Test controllers by mocking the service layer, without touching HTTP transport
- Test guards in isolation by constructing a fake `ExecutionContext`
- Test pipes directly by calling `transform()` with sample values, bypassing the request pipeline
- Set up a true e2e test using `app.init()` to boot a full running Nest application
- Drive e2e tests with Supertest, including authenticated flows (login, then use the returned token)
- Apply database cleanup strategies for e2e tests: per-test transactions and truncate-between-tests

## Topics

| File | Topic | Time |
|------|-------|------|
| [01-Unit-Testing-with-Jest.md](01-Unit-Testing-with-Jest.md) | Unit Testing with Jest — Testing Module, Mocking Providers | 1 day |
| [02-Testing-Controllers-Guards-and-Pipes.md](02-Testing-Controllers-Guards-and-Pipes.md) | Testing Controllers, Guards, and Pipes in Isolation | 1 day |
| [03-E2E-Testing-with-Supertest.md](03-E2E-Testing-with-Supertest.md) | End-to-End Testing with Supertest and a Real Database | 1 day |

## Estimated Time

3 days

## Previous Phase

→ [Phase 9: Database Integration](../Phase-09-Database-Integration/README.md)

## Next Phase

→ [Phase 11: Microservices and Realtime](../Phase-11-Microservices-and-Realtime/README.md)
