# Project 1 — Notes/Todo REST API (Controllers & Routing)

**Level:** Beginner
**Time estimate:** 2 – 3 hours
**Phase prerequisite:** Phase 3 – Controllers and Routing

---

## Overview

You will build a minimal REST API for managing `Note` resources: full CRUD (`GET`, `POST`, `PATCH`, `DELETE`) backed by a plain in-memory array — no database yet. The goal is to internalize the mechanics of a Nest controller before anything else (DI, modules, pipes) is layered on top:

- `@Controller('notes')` and the HTTP method decorators (`@Get`, `@Post`, `@Patch`, `@Delete`)
- Route parameters (`@Param`) and request bodies (`@Body`)
- Plain DTO classes (no validation library yet — that's Project 2)
- `HttpException`/`NotFoundException` for a missing note
- Returning the right HTTP status per verb

---

## Prerequisites

- Node.js 18+ and npm
- Nest CLI installed globally: `npm i -g @nestjs/cli`
- Completed Phase 1–3 of the NestJS course

---

## Project Structure

```
01-notes-api/
├── package.json
├── tsconfig.json
├── nest-cli.json
└── src/
    ├── main.ts
    ├── app.module.ts
    └── notes/
        ├── notes.module.ts
        ├── notes.controller.ts
        ├── notes.service.ts
        ├── dto/
        │   ├── create-note.dto.ts
        │   └── update-note.dto.ts
        └── entities/
            └── note.entity.ts
```

---

## Step-by-Step Instructions

### Step 1 — Scaffold the project

```bash
nest new 01-notes-api --package-manager npm
cd 01-notes-api
nest generate module notes
nest generate controller notes
nest generate service notes
```

### Step 2 — Define the Note shape

`src/notes/entities/note.entity.ts`

```typescript
export class Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Step 3 — Plain DTOs (no class-validator yet — that's Project 2)

`src/notes/dto/create-note.dto.ts`

```typescript
export class CreateNoteDto {
  title: string;
  content: string;
}
```

`src/notes/dto/update-note.dto.ts`

```typescript
export class UpdateNoteDto {
  title?: string;
  content?: string;
}
```

### Step 4 — Service holding the in-memory store

`src/notes/notes.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Note } from './entities/note.entity';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Injectable()
export class NotesService {
  // In-memory store — resets every time the process restarts.
  // Project 2 replaces this with a real TypeORM repository.
  private notes: Note[] = [];

  findAll(): Note[] {
    return this.notes;
  }

  findOne(id: string): Note {
    const note = this.notes.find((n) => n.id === id);
    if (!note) {
      throw new NotFoundException(`Note with id "${id}" not found`);
    }
    return note;
  }

  create(dto: CreateNoteDto): Note {
    const now = new Date();
    const note: Note = {
      id: randomUUID(),
      title: dto.title,
      content: dto.content,
      createdAt: now,
      updatedAt: now,
    };
    this.notes.push(note);
    return note;
  }

  update(id: string, dto: UpdateNoteDto): Note {
    const note = this.findOne(id);
    if (dto.title !== undefined) note.title = dto.title;
    if (dto.content !== undefined) note.content = dto.content;
    note.updatedAt = new Date();
    return note;
  }

  remove(id: string): void {
    const index = this.notes.findIndex((n) => n.id === id);
    if (index === -1) {
      throw new NotFoundException(`Note with id "${id}" not found`);
    }
    this.notes.splice(index, 1);
  }
}
```

### Step 5 — Controller

`src/notes/notes.controller.ts`

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
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findAll() {
    return this.notesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateNoteDto) {
    return this.notesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    this.notesService.remove(id);
  }
}
```

### Step 6 — Module and bootstrap

`src/notes/notes.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
```

`src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { NotesModule } from './notes/notes.module';

@Module({
  imports: [NotesModule],
})
export class AppModule {}
```

`src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

### Step 7 — Run it

```bash
npm run start:dev
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| List notes (empty) | `curl http://localhost:3000/notes` | `200 OK`, `[]` |
| Create a note | `curl -i -X POST http://localhost:3000/notes -H "Content-Type: application/json" -d '{"title":"Groceries","content":"Milk, eggs"}'` | `201 Created`, JSON body with generated `id` |
| Fetch by id | `curl http://localhost:3000/notes/<id-from-above>` | `200 OK`, matching note |
| Fetch missing id | `curl -i http://localhost:3000/notes/does-not-exist` | `404 Not Found`, Nest's standard error JSON shape |
| Update a note | `curl -i -X PATCH http://localhost:3000/notes/<id> -H "Content-Type: application/json" -d '{"content":"Milk, eggs, bread"}'` | `200 OK`, `content` updated, `updatedAt` changed |
| Delete a note | `curl -i -X DELETE http://localhost:3000/notes/<id>` | `204 No Content`, subsequent `GET` on that id returns `404` |

---

## Stretch Goals

1. **Query filtering** — add `GET /notes?search=term` using `@Query()` to filter notes whose title or content contains the search term (case-insensitive).
2. **Pagination** — add `?page=1&limit=10` query params and return `{ data, total, page, limit }`.
3. **Toggle completion** — add a `completed: boolean` field and a dedicated `PATCH /notes/:id/complete` route.
4. **Basic manual validation** — before Project 2 introduces `class-validator`, add a small hand-rolled check in the service that throws `BadRequestException` when `title` is empty, to feel the pain that a real validation pipe later removes.
5. **In-memory sorting** — add `?sortBy=createdAt&order=desc` support to `findAll`.
