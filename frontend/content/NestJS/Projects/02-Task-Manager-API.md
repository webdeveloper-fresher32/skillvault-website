# Project 2 — Task Manager API (Providers, Modules, Pipes & Validation)

**Level:** Beginner-Intermediate
**Time estimate:** 3 – 4 hours
**Phase prerequisite:** Phase 4-6 – Providers/DI, Modules, Pipes & Validation

---

## Overview

You will model a real relational domain — a `User` has many `Task`s — and persist it with **TypeORM** (the ORM used consistently for the rest of this course's projects). You will:

1. Define `User` and `Task` entities with a `@OneToMany`/`@ManyToOne` relationship.
2. Move every business rule into an injectable `@Injectable() TasksService`, keeping the controller a thin HTTP adapter.
3. Validate every incoming request with `class-validator` DTOs, enforced globally via Nest's `ValidationPipe`.
4. Enforce a domain rule — "a user cannot have more than 20 open (non-completed) tasks" — inside the service layer, not the controller.

This is the project where Nest's dependency injection container stops being an abstract idea: `TasksService` is injected into `TasksController`, and TypeORM's `Repository<Task>` is injected into `TasksService` via `@InjectRepository()`.

---

## Prerequisites

- Completed Project 1
- Node.js 18+, Nest CLI
- Basic familiarity with SQL (this project uses SQLite for zero-setup persistence)

---

## Project Structure

```
02-task-manager-api/
├── package.json
├── tsconfig.json
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── users/
    │   ├── users.module.ts
    │   ├── users.controller.ts
    │   ├── users.service.ts
    │   ├── dto/
    │   │   └── create-user.dto.ts
    │   └── entities/
    │       └── user.entity.ts
    └── tasks/
        ├── tasks.module.ts
        ├── tasks.controller.ts
        ├── tasks.service.ts
        ├── dto/
        │   ├── create-task.dto.ts
        │   └── update-task.dto.ts
        └── entities/
            └── task.entity.ts
```

---

## Step-by-Step Instructions

### Step 1 — Scaffold and install dependencies

```bash
nest new 02-task-manager-api --package-manager npm
cd 02-task-manager-api
npm install @nestjs/typeorm typeorm sqlite3
npm install class-validator class-transformer
nest generate module users
nest generate module tasks
nest generate controller users
nest generate controller tasks
nest generate service users
nest generate service tasks
```

### Step 2 — Entities

`src/users/entities/user.entity.ts`

```typescript
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @OneToMany(() => Task, (task) => task.user)
  tasks: Task[];
}
```

`src/tasks/entities/task.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TaskStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'varchar', default: TaskStatus.OPEN })
  status: TaskStatus;

  @ManyToOne(() => User, (user) => user.tasks, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Step 3 — DTOs with class-validator

`src/users/dto/create-user.dto.ts`

```typescript
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
```

`src/tasks/dto/create-task.dto.ts`

```typescript
import { IsNotEmpty, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  userId: string;
}
```

`src/tasks/dto/update-task.dto.ts`

```typescript
import { IsEnum, IsOptional, MaxLength } from 'class-validator';
import { TaskStatus } from '../entities/task.entity';

export class UpdateTaskDto {
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
```

### Step 4 — Enable the global ValidationPipe

`src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not defined on the DTO
      forbidNonWhitelisted: true, // reject requests with unknown properties
      transform: true, // auto-transform payloads to DTO instances
    }),
  );
  await app.listen(3000);
}
bootstrap();
```

### Step 5 — Users module

`src/users/users.service.ts`

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Email "${dto.email}" is already registered`);
    }
    const user = this.usersRepository.create(dto);
    return this.usersRepository.save(user);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    return user;
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }
}
```

`src/users/users.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
```

`src/users/users.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### Step 6 — Tasks module (the business rule lives here)

`src/tasks/tasks.service.ts`

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UsersService } from '../users/users.service';

const MAX_OPEN_TASKS_PER_USER = 20;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly tasksRepository: Repository<Task>,
    private readonly usersService: UsersService, // injected across module boundaries via UsersModule's exports
  ) {}

  async create(dto: CreateTaskDto): Promise<Task> {
    // Throws NotFoundException if the user doesn't exist — controllers never
    // need to know this rule; it's a service-to-service dependency.
    await this.usersService.findOne(dto.userId);

    const openCount = await this.tasksRepository.count({
      where: [
        { userId: dto.userId, status: TaskStatus.OPEN },
        { userId: dto.userId, status: TaskStatus.IN_PROGRESS },
      ],
    });

    if (openCount >= MAX_OPEN_TASKS_PER_USER) {
      throw new BadRequestException(
        `User already has ${MAX_OPEN_TASKS_PER_USER} open tasks — complete some before adding more`,
      );
    }

    const task = this.tasksRepository.create({ ...dto });
    return this.tasksRepository.save(task);
  }

  findAllForUser(userId: string): Promise<Task[]> {
    return this.tasksRepository.find({ where: { userId } });
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task with id "${id}" not found`);
    }
    return task;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    Object.assign(task, dto);
    return this.tasksRepository.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    await this.tasksRepository.remove(task);
  }
}
```

`src/tasks/tasks.controller.ts`

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
  Post,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Get()
  findAllForUser(@Query('userId') userId: string) {
    return this.tasksService.findAllForUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.tasksService.remove(id);
  }
}
```

`src/tasks/tasks.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), UsersModule], // UsersModule.exports makes UsersService injectable here
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
```

### Step 7 — Root module and TypeORM config

`src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { TasksModule } from './tasks/tasks.module';
import { User } from './users/entities/user.entity';
import { Task } from './tasks/entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'task-manager.sqlite',
      entities: [User, Task],
      synchronize: true, // dev-only: auto-creates schema from entities
    }),
    UsersModule,
    TasksModule,
  ],
})
export class AppModule {}
```

### Step 8 — Run it

```bash
npm run start:dev
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Create a user | `curl -i -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"email":"a@b.com","name":"Ada"}'` | `201 Created`, JSON with generated `id` |
| Duplicate email rejected | Repeat the same request | `409 Conflict` |
| Validation rejects bad input | `curl -i -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"email":"not-an-email"}'` | `400 Bad Request`, message array mentioning `email` |
| Create a task | `curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Write report","userId":"<user-id>"}'` | `201 Created` |
| Task for missing user | Use a random UUID as `userId` | `404 Not Found` |
| 20-task limit enforced | Script 20 `POST /tasks` for the same user, then a 21st | First 20 succeed with `201`; the 21st returns `400 Bad Request` with the limit message |
| Unknown property rejected | `POST /tasks` with an extra `foo: "bar"` field | `400 Bad Request` (from `forbidNonWhitelisted: true`) |

---

## Stretch Goals

1. **Soft delete** — replace hard `remove()` with TypeORM's `@DeleteDateColumn()` and `softRemove()`, and exclude soft-deleted tasks from `findAllForUser`.
2. **Task filtering** — add `GET /tasks?userId=...&status=OPEN` support via TypeORM's `where` combinators.
3. **Custom validation decorator** — write a custom `class-validator` decorator (e.g. `@IsNotPastDate()`) for a `dueDate` field you add to `Task`.
4. **Transactional task reassignment** — add `PATCH /tasks/:id/reassign` that moves a task to a different user, wrapped in a TypeORM `QueryRunner` transaction that re-checks the 20-task limit for the destination user before committing.
5. **Pagination + sorting** — add `?page=&limit=&sortBy=` to `findAllForUser` using TypeORM's `skip`/`take`/`order`.
