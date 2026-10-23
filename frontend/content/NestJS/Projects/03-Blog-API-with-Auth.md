# Project 3 — Blog API with JWT Auth, Guards, Filters & Interceptors

**Level:** Intermediate
**Time estimate:** 4 – 5 hours
**Phase prerequisite:** Phase 7-8 – Guards/Authentication & Interceptors/Filters/Custom Decorators

---

## Overview

You will layer production request-pipeline concerns onto a `Post`/`Author` blogging domain:

1. **JWT authentication** — a Passport `JwtStrategy` validates bearer tokens; a `POST /auth/login` issues them.
2. **Guards** — a `JwtAuthGuard` protects write endpoints; a custom `RolesGuard` + `@Roles()` decorator enforces that only the post's author (or an `ADMIN`) may edit/delete it.
3. **Global exception filter** — `AllExceptionsFilter` normalizes every thrown error (Nest `HttpException`s and unexpected ones) into one consistent JSON shape.
4. **Response interceptor** — `TransformInterceptor` wraps every successful response body in `{ data, timestamp }`.
5. **Custom parameter decorator** — `@CurrentUser()` pulls the authenticated user off the request without repeating `req.user` everywhere.

This project makes Nest's full request pipeline concrete: **pipe → guard → interceptor (before) → handler → interceptor (after) → filter (only on error)**.

---

## Prerequisites

- Completed Project 2 (TypeORM + service layer + validation)
- Node.js 18+, Nest CLI

---

## Project Structure

```
03-blog-api/
├── package.json
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── common/
    │   ├── decorators/
    │   │   ├── roles.decorator.ts
    │   │   └── current-user.decorator.ts
    │   ├── filters/
    │   │   └── all-exceptions.filter.ts
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts
    │   │   └── roles.guard.ts
    │   └── interceptors/
    │       └── transform.interceptor.ts
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── jwt.strategy.ts
    │   └── dto/
    │       └── login.dto.ts
    ├── users/
    │   ├── users.module.ts
    │   ├── users.service.ts
    │   └── entities/
    │       └── user.entity.ts
    └── posts/
        ├── posts.module.ts
        ├── posts.controller.ts
        ├── posts.service.ts
        ├── dto/
        │   ├── create-post.dto.ts
        │   └── update-post.dto.ts
        └── entities/
            └── post.entity.ts
```

---

## Step-by-Step Instructions

### Step 1 — Install dependencies

```bash
nest new 03-blog-api --package-manager npm
cd 03-blog-api
npm install @nestjs/typeorm typeorm sqlite3
npm install @nestjs/passport passport passport-jwt @nestjs/jwt
npm install bcrypt
npm install class-validator class-transformer
npm install -D @types/passport-jwt @types/bcrypt
```

### Step 2 — User entity with role and hashed password

`src/users/entities/user.entity.ts`

```typescript
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
  AUTHOR = 'AUTHOR',
  ADMIN = 'ADMIN',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar', default: UserRole.AUTHOR })
  role: UserRole;
}
```

### Step 3 — Post entity owned by an author

`src/posts/entities/post.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column()
  authorId: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Step 4 — Auth: login DTO, service, strategy, controller

`src/auth/dto/login.dto.ts`

```typescript
import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}
```

`src/auth/auth.service.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
```

`src/auth/jwt.strategy.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-me',
    });
  }

  // Whatever this returns becomes `request.user`.
  async validate(payload: JwtPayload) {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
```

`src/auth/auth.controller.ts`

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

`src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

### Step 5 — Guards: JwtAuthGuard and RolesGuard

`src/common/guards/jwt-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Simply delegates to the 'jwt' Passport strategy registered above.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

`src/common/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

`src/common/guards/roles.guard.ts`

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no @Roles() decorator present — no restriction
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
```

> `RolesGuard` above enforces roles set via metadata. Author-only edit rules (post ownership) are enforced explicitly inside `PostsService`, since "the current user owns *this specific* resource" is a data check, not a static role check — mixing the two into one guard makes the guard's intent unclear.

### Step 6 — Custom `@CurrentUser()` param decorator

`src/common/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### Step 7 — Global exception filter

`src/common/filters/all-exceptions.filter.ts`

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      // Log unexpected errors with the full stack; never leak internals to the client.
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
```

### Step 8 — Response transform interceptor

`src/common/interceptors/transform.interceptor.ts`

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

export interface Response<T> {
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### Step 9 — Posts service enforcing ownership

`src/posts/dto/create-post.dto.ts`

```typescript
import { IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsNotEmpty()
  content: string;
}
```

`src/posts/dto/update-post.dto.ts`

```typescript
import { IsOptional, MaxLength } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  content?: string;
}
```

`src/posts/posts.service.ts`

```typescript
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly postsRepository: Repository<Post>,
  ) {}

  findAll(): Promise<Post[]> {
    return this.postsRepository.find();
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postsRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with id "${id}" not found`);
    }
    return post;
  }

  create(dto: CreatePostDto, authorId: string): Promise<Post> {
    const post = this.postsRepository.create({ ...dto, authorId });
    return this.postsRepository.save(post);
  }

  async update(
    id: string,
    dto: UpdatePostDto,
    currentUser: { userId: string; role: string },
  ): Promise<Post> {
    const post = await this.findOne(id);
    this.assertOwnerOrAdmin(post, currentUser);
    Object.assign(post, dto);
    return this.postsRepository.save(post);
  }

  async remove(id: string, currentUser: { userId: string; role: string }): Promise<void> {
    const post = await this.findOne(id);
    this.assertOwnerOrAdmin(post, currentUser);
    await this.postsRepository.remove(post);
  }

  // Ownership check — deliberately not in a Guard, since it needs the loaded
  // entity (post.authorId), not just static route metadata.
  private assertOwnerOrAdmin(post: Post, currentUser: { userId: string; role: string }): void {
    if (post.authorId !== currentUser.userId && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException('Only the author or an admin may modify this post');
    }
  }
}
```

`src/posts/posts.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post as HttpPost,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpPost()
  create(@Body() dto: CreatePostDto, @CurrentUser() user: { userId: string }) {
    return this.postsService.create(dto, user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.postsService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: { userId: string; role: string }) {
    await this.postsService.remove(id, user);
  }
}
```

### Step 10 — Wire global filter/interceptor and TypeORM

`src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  await app.listen(3000);
}
bootstrap();
```

`src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { RolesGuard } from './common/guards/roles.guard';
import { User } from './users/entities/user.entity';
import { Post } from './posts/entities/post.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'blog.sqlite',
      entities: [User, Post],
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
    PostsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RolesGuard }, // applied globally; no-ops when no @Roles() present
  ],
})
export class AppModule {}
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Public read, no token needed | `curl http://localhost:3000/posts` | `200 OK`, body wrapped as `{ "data": [...], "timestamp": "..." }` |
| Create post without token | `curl -i -X POST http://localhost:3000/posts -d '{"title":"x","content":"y"}' -H "Content-Type: application/json"` | `401 Unauthorized`, filtered error JSON shape |
| Login | `curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"secret"}'` | `200 OK`, `{ "data": { "accessToken": "..." } }` |
| Create post with token | `curl -i -X POST http://localhost:3000/posts -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"title":"Hello","content":"World"}'` | `201 Created`, `authorId` matches the logged-in user |
| Edit someone else's post | Log in as a different author, `PATCH` the first post | `403 Forbidden` |
| Unhandled error still normalized | Temporarily throw a raw `Error('boom')` inside a handler | Response still `{ statusCode: 500, path, timestamp, message: "Internal server error" }`, stack trace only in server logs |

---

## Stretch Goals

1. **Refresh tokens** — add a `POST /auth/refresh` endpoint backed by a longer-lived refresh token stored hashed in the database.
2. **Rate-limit login** — add `@nestjs/throttler` to `POST /auth/login` to slow down brute-force attempts.
3. **Admin-only user management** — add a `UsersController` with `@Roles('ADMIN')` + `RolesGuard`-protected endpoints to list/ban users.
4. **Comment resource** — add a `Comment` entity with its own ownership rule, reusing the same `assertOwnerOrAdmin` pattern.
5. **Structured validation error shape** — extend `AllExceptionsFilter` to flatten `class-validator`'s nested constraint messages into a flat `{ field, message }[]` array.
