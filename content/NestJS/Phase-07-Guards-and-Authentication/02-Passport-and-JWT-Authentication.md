# Passport & JWT Authentication — Complete Guide

## Table of Contents
1. [Why Passport](#1-why-passport)
2. [The Strategy Pattern — PassportStrategy](#2-the-strategy-pattern--passportstrategy)
3. [Full Login Flow Overview](#3-full-login-flow-overview)
4. [AuthService — Validating Credentials and Issuing a JWT](#4-authservice--validating-credentials-and-issuing-a-jwt)
5. [Building the JwtStrategy](#5-building-the-jwtstrategy)
6. [AuthGuard('jwt') and the JwtAuthGuard Wrapper](#6-authguardjwt-and-the-jwtauthguard-wrapper)
7. [Wiring It Together — AuthModule](#7-wiring-it-together--authmodule)
8. [Protecting Routes](#8-protecting-routes)
9. [Refresh Tokens](#9-refresh-tokens)
10. [Common Pitfalls](#10-common-pitfalls)
11. [Best Practices](#11-best-practices)
12. [Hands-On Exercises](#12-hands-on-exercises)
13. [Interview Q&A](#13-interview-qa)

---

## 1. Why Passport

Passport is a battle-tested, middleware-based authentication library for Node.js with hundreds of "strategies" — pluggable modules for authenticating via username/password, JWT, OAuth (Google, GitHub, etc.), SAML, and more. `@nestjs/passport` is a thin wrapper that adapts Passport strategies into Nest's guard system, so an authentication scheme becomes just another `CanActivate` guard you can apply with `@UseGuards()`.

You could hand-roll JWT verification inside a custom guard (as sketched in lesson 1's `SessionGuard`), and for simple cases that's reasonable. Passport earns its place once you need: a standard, well-tested extraction/verification pipeline; the ability to swap or add strategies (local login today, Google OAuth tomorrow) without rewriting guard logic; and consistent integration with the wider Node ecosystem's tooling and documentation.

```
  npm install @nestjs/passport passport passport-jwt @nestjs/jwt
  npm install -D @types/passport-jwt
```

---

## 2. The Strategy Pattern — PassportStrategy

Every Passport strategy in Nest is a class that extends the mixin returned by `PassportStrategy(StrategyClass)`, where `StrategyClass` comes from the underlying `passport-*` package (`passport-jwt`, `passport-local`, etc.). The subclass's job is twofold: configure the strategy's constructor options (how to extract credentials from the request), and implement a `validate()` method that Passport calls once it has successfully extracted/verified the raw credential.

```typescript
// Generic shape every strategy in this lesson follows:
@Injectable()
export class SomeStrategy extends PassportStrategy(SomeUnderlyingStrategy, 'some-name') {
  constructor() {
    super({ /* strategy-specific extraction/verification options */ });
  }

  async validate(...args: any[]): Promise<any> {
    // args depend on the strategy; for JWT it's the decoded payload.
    // Whatever this returns becomes `request.user`.
  }
}
```

Crucially, `validate()` is **not** where you re-verify the token's signature or expiry — Passport (via `passport-jwt`) has already done that before calling `validate()`. Its job is to take the already-verified payload and turn it into the application's notion of "the current user" — typically by looking the user up in the database and returning a clean user object (or throwing `UnauthorizedException` if, say, the user has since been deleted or disabled).

---

## 3. Full Login Flow Overview

```
  POST /auth/login  { email, password }
          │
          ▼
  AuthController.login()
          │
          ▼
  AuthService.validateUser(email, password)
    - look up user by email
    - bcrypt.compare(password, user.passwordHash)
    - throw UnauthorizedException if mismatch
          │
          ▼
  AuthService.login(user)
    - build JWT payload { sub: user.id, email: user.email, roles: user.roles }
    - jwtService.sign(payload)   →  signed, time-limited access token
          │
          ▼
  Response: { accessToken: "<jwt>" }


  Later — client calls a protected route:

  GET /users/me
  Authorization: Bearer <jwt>
          │
          ▼
  JwtAuthGuard  (extends AuthGuard('jwt'))
          │
          ▼
  Passport's passport-jwt strategy:
    1. Extract token from Authorization header
    2. Verify signature + expiry using the shared secret
    3. Decode payload, call JwtStrategy.validate(payload)
          │
          ▼
  JwtStrategy.validate(payload)
    - look up user by payload.sub (fresh DB read, or trust payload)
    - return user object  →  becomes request.user
          │
          ▼
  Route handler executes, reading request.user (or @CurrentUser())
```

---

## 4. AuthService — Validating Credentials and Issuing a JWT

```typescript
// auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;   // subject — the user's id
  email: string;
  roles: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Verifies raw credentials. Called by the login endpoint (or by a
   * LocalStrategy if you add one). Returns a safe user object with no
   * password hash on success, throws on failure.
   */
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Issues a signed access token for an already-validated user.
   */
  async login(user: { id: string; email: string; roles: string[] }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
```

```typescript
// auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    return this.authService.login(user);
  }
}
```

```typescript
// dto/login.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

Note that `/auth/login` itself must **not** be behind `JwtAuthGuard` — there is no token yet to check. If `JwtAuthGuard` is applied globally (see lesson 3's `@Public()` pattern), the login route needs to be explicitly excluded.

---

## 5. Building the JwtStrategy

```typescript
// jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      // How to pull the raw token out of the incoming request:
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Reject expired tokens (passport-jwt checks `exp` for you when false):
      ignoreExpiration: false,
      // The same secret used to sign tokens in JwtModule.register():
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Called by Passport AFTER it has already verified the token's signature
   * and expiry. `payload` is the decoded JWT body. Whatever this method
   * returns becomes `request.user` for the rest of the pipeline.
   */
  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      // Handles the case where a user was deleted/disabled after the
      // token was issued — a valid signature does not mean a valid user.
      throw new UnauthorizedException('User no longer exists');
    }

    return { id: user.id, email: user.email, roles: user.roles };
  }
}
```

`ExtractJwt.fromAuthHeaderAsBearerToken()` reads the `Authorization: Bearer <token>` header — the standard convention. `passport-jwt` also supports extracting from cookies or query strings via other `ExtractJwt` helpers, or `ExtractJwt.fromExtractors([...])` to try several in order, which is useful if you need to support both a header (for API clients) and a cookie (for browser clients) simultaneously.

---

## 6. AuthGuard('jwt') and the JwtAuthGuard Wrapper

`@nestjs/passport` exports a generic `AuthGuard(strategyName)` mixin that turns any registered strategy into a usable `CanActivate` guard:

```typescript
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Get('me')
getProfile() { /* ... */ }
```

In practice, almost every real project wraps this in its own named guard class instead of referencing the string `'jwt'` everywhere. This gives you a single place to add custom logic (like the `@Public()` bypass pattern from lesson 3) and avoids "magic string" typos:

```typescript
// jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Override handleRequest to customize error behavior, e.g. always
  // throw UnauthorizedException with a consistent message instead of
  // leaking Passport's default error shape.
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new (require('@nestjs/common').UnauthorizedException)(
        'Invalid or missing access token',
      );
    }
    return user;
  }
}
```

`handleRequest` is a hook `AuthGuard` calls after the strategy's `validate()` resolves (or fails); overriding it is the standard extension point for custom error messages, logging failed auth attempts, or the `@Public()` route bypass shown in lesson 3.

---

## 7. Wiring It Together — AuthModule

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' }, // short-lived access token
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

Using `JwtModule.registerAsync()` with `ConfigService` (rather than `JwtModule.register({ secret: 'hardcoded' })`) means the secret is pulled from environment configuration — see the pitfalls section for why this matters.

---

## 8. Protecting Routes

```typescript
// users.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Request } from 'express';

@Controller('users')
export class UsersController {
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: Request) {
    // req.user was set by JwtStrategy.validate()'s return value
    return req.user;
  }
}
```

Lesson 3 replaces the raw `@Req() req: Request` + `req.user` pattern with a cleaner `@CurrentUser()` parameter decorator — but the underlying mechanism (Passport attaching the strategy's return value to `request.user`) is exactly what's demonstrated here.

---

## 9. Refresh Tokens

Short-lived access tokens (5-15 minutes) limit the damage window if a token is stolen, but requiring re-login every 15 minutes is a poor user experience. The standard mitigation is a **refresh token**: a longer-lived, more restricted credential used only to obtain new access tokens.

```
  Access token:  short TTL (minutes), sent on every API request,
                 used by JwtStrategy/JwtAuthGuard on protected routes.

  Refresh token: long TTL (days/weeks), sent ONLY to POST /auth/refresh,
                 never sent to ordinary API routes, stored more carefully
                 (httpOnly cookie, or hashed in the DB for revocation).
```

Key design points worth knowing even without implementing the full flow here:

- **Issue both on login.** `AuthService.login()` returns `{ accessToken, refreshToken }`; the refresh token is typically signed with a *different* secret and a much longer `expiresIn`.
- **Store a hash of the refresh token server-side**, keyed by user (or per-device), so it can be revoked (e.g., on logout or password change) — a bare stateless JWT refresh token cannot be revoked before its expiry without this.
- **Rotate on use.** Each call to `/auth/refresh` should invalidate the old refresh token and issue a new one ("refresh token rotation"). This limits the blast radius if a refresh token is intercepted, since a reused old token becomes detectable and can trigger revoking the whole token family.
- **A separate `RefreshJwtStrategy` (or manual verification in the controller)** validates the refresh token against its own secret and, if valid and not revoked, calls `AuthService.login()` again to issue a fresh access token (and, with rotation, a fresh refresh token).
- **Never send the refresh token to routes protected by `JwtAuthGuard`.** It should only ever be presented to the dedicated refresh endpoint, ideally via an `httpOnly`, `secure`, `sameSite` cookie rather than being handled by client-side JavaScript at all, to reduce XSS exposure.

```typescript
// Sketch — not a full implementation, illustrates the shape only.
@Post('refresh')
async refresh(@Body('refreshToken') token: string) {
  const payload = this.jwtService.verify(token, {
    secret: this.configService.get('JWT_REFRESH_SECRET'),
  });

  const storedHash = await this.refreshTokensService.findHashForUser(payload.sub);
  const isValid = storedHash && (await bcrypt.compare(token, storedHash));
  if (!isValid) {
    throw new UnauthorizedException('Refresh token revoked or invalid');
  }

  await this.refreshTokensService.rotate(payload.sub); // invalidate old, issue new
  const user = await this.usersService.findById(payload.sub);
  return this.authService.login(user); // new access + refresh token pair
}
```

---

## 10. Common Pitfalls

- **Hardcoding the JWT secret as a string literal.** `JwtModule.register({ secret: 'my-secret' })` commits the secret to source control. Always source it from `ConfigService`/environment variables, and use `registerAsync` so it can be injected.
- **Using the same secret for access and refresh tokens.** If they're the same, a leaked access token payload structure makes forging a "refresh token" trivial. Use distinct secrets (and ideally distinct signing algorithms/claims) per token type.
- **Trusting the JWT payload without a fresh user lookup.** If `JwtStrategy.validate()` just returns the payload directly without checking the user still exists/is still active, a disabled or deleted user's still-valid (not-yet-expired) token continues to work.
- **Forgetting to exclude `/auth/login` (and `/auth/refresh`) from a global `JwtAuthGuard`.** This creates a chicken-and-egg deadlock: you need a token to get a token.
- **Long-lived access tokens "for convenience."** This defeats the entire purpose of short-lived tokens; use refresh tokens instead of extending the access token's `expiresIn`.
- **No revocation strategy.** Because JWTs are stateless by design, a compromised access token remains valid until it expires no matter what the server does — unless you maintain a deny-list or keep TTLs short and rely on refresh-token revocation as the actual control point.
- **Sending refresh tokens in `localStorage`/response bodies read by JS.** This exposes them to XSS; prefer `httpOnly` cookies for refresh tokens specifically.

---

## 11. Best Practices

- Keep access tokens short-lived (minutes) and put all long-lived trust in a revocable refresh token.
- Store secrets in environment variables/secret managers, never in source, and use different secrets for access vs. refresh tokens.
- Always do a fresh user existence/status check in `JwtStrategy.validate()` rather than trusting the payload blindly.
- Hash refresh tokens before persisting them (treat them like passwords) so a database leak doesn't hand out valid refresh tokens directly.
- Implement refresh token rotation and detect reuse of old tokens as a signal of compromise.
- Return generic "Invalid credentials" messages on login failure (don't reveal whether the email exists) to avoid user enumeration.
- Rate-limit the login and refresh endpoints separately from the rest of the API.

---

## 12. Hands-On Exercises

**Exercise 1:** Build the full `AuthModule` shown in this lesson end to end, including a minimal in-memory `UsersService` with one seeded user (bcrypt-hashed password). Confirm `POST /auth/login` with correct credentials returns an `accessToken`, and with incorrect credentials returns `401`.

**Exercise 2:** Add `@UseGuards(JwtAuthGuard)` to a `GET /users/me` route and confirm: no `Authorization` header → 401; a malformed token → 401; a valid token → the decoded user is returned.

**Exercise 3:** Deliberately set `ignoreExpiration: true` in the strategy, sign a token with `expiresIn: '1s'`, wait past expiry, and call the protected route — confirm the request now succeeds despite the token being "expired," then set `ignoreExpiration: false` and confirm it correctly starts failing with `401`. This demonstrates why that option must never be `true` in production.

**Exercise 4:** Implement a second, separate `JWT_REFRESH_SECRET` and a `POST /auth/refresh` endpoint per the sketch in section 9 (without persistence — just verify + reissue). Confirm a refresh token cannot be used directly against `JwtAuthGuard`-protected routes (it will fail because it was signed with a different secret).

**Exercise 5:** Add a `usersService.findByEmail` call to `JwtStrategy.validate()` that additionally checks a hypothetical `user.isDisabled` flag, throwing `UnauthorizedException` if true. Manually flip a seeded user's flag and confirm a previously-valid, non-expired token is now rejected — demonstrating why payload trust alone is insufficient.

---

## 13. Interview Q&A

**Q: What is the responsibility split between `PassportStrategy`'s constructor options and its `validate()` method?**
Answer: The constructor (via `super({...})`) configures how the raw credential is extracted and cryptographically verified — for `passport-jwt`, that's where the token extraction method and the signing secret/expiry-check are configured. `validate()` runs only after that extraction and verification has already succeeded; its job is purely to turn the verified payload into the application's user object (typically via a database lookup), and whatever it returns becomes `request.user`. It should never re-implement signature verification itself.

**Q: Why shouldn't you trust a decoded JWT payload as-is inside `validate()`?**
Answer: A valid signature only proves the token was issued by your server and hasn't been tampered with or expired — it says nothing about whether the referenced user is still active. If a user is deleted, disabled, or has their roles changed after a token is issued, the old token remains cryptographically valid until it expires. Doing a fresh database lookup inside `validate()` (and throwing `UnauthorizedException` if the user is gone or disabled) closes that gap.

**Q: Why are access tokens kept short-lived while refresh tokens are long-lived, and why is that not just an inconvenience trade-off?**
Answer: It's a blast-radius control. Access tokens are sent on every request and are the ones most exposed to interception (logs, browser extensions, proxies); keeping their TTL short limits how long a stolen one is useful. Refresh tokens are sent far less often (only to the dedicated refresh endpoint, ideally via an `httpOnly` cookie) and can be made revocable server-side by storing a hash and checking it on each refresh — something a purely stateless JWT can't otherwise support. This lets the system get both good UX (no frequent re-login) and a real revocation mechanism.

**Q: What does `AuthGuard('jwt')` actually do, and why wrap it in a custom `JwtAuthGuard` class?**
Answer: `AuthGuard('jwt')` is a mixin from `@nestjs/passport` that adapts the registered Passport strategy named `'jwt'` into a `CanActivate` guard — it triggers the strategy's extraction/verification, then calls `validate()`, then calls `handleRequest()` to decide the final outcome. Wrapping it in a named `JwtAuthGuard extends AuthGuard('jwt')` class avoids referencing the magic string `'jwt'` throughout the codebase, gives one place to override `handleRequest()` for custom error handling, and is the natural extension point for cross-cutting behavior like a `@Public()` route bypass.

**Q: How would you support both a `@Public()` login route and a globally applied `JwtAuthGuard`?**
Answer: Register `JwtAuthGuard` globally via the `APP_GUARD` token so every route requires authentication by default, then mark exceptions (like `/auth/login`) with a custom `@Public()` decorator built on `SetMetadata`. Inside `JwtAuthGuard.canActivate()`, use a `Reflector` to check for that metadata on the handler/class and return `true` immediately if present, skipping the Passport strategy entirely. This is the same `SetMetadata` + `Reflector` pattern used for `@Roles()` in lesson 3, just applied to bypass rather than to further restrict access.

**Q: What's the security risk of storing a refresh token in `localStorage`, and what's the standard mitigation?**
Answer: Anything in `localStorage` is readable by any JavaScript running on the page, so an XSS vulnerability anywhere in the frontend can exfiltrate the refresh token directly, giving an attacker long-lived account access. The standard mitigation is to issue the refresh token as an `httpOnly`, `secure`, `sameSite` cookie instead — `httpOnly` makes it inaccessible to JavaScript entirely, so an XSS bug can no longer read it directly (though CSRF protections are then needed instead, since cookies are sent automatically by the browser).
