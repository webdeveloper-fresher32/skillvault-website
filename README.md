# SkillVault — Developer Learning Operating System

<div align="center">

![SkillVault Platform Banner](./docs/images/01-homepage-hero.png)

> **An enterprise-grade, full-stack developer learning platform and curriculum management system.**  
> Built with modern **Java 17 / Spring Boot 4**, **Next.js 16 (Turbopack)**, **PostgreSQL**, and a reactive markdown content indexing engine.

[![Java](https://img.shields.io/badge/Java-17%2B-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.1-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

[System Architecture](#-system-architecture) · [API Reference](#-api-reference) · [Database Design](#-database-design) · [Local Setup](#-local-development--getting-started) · [Engineering Decisions](#-engineering-highlights--architectural-decisions)

</div>

---

## 📖 Executive Summary

**SkillVault** is a production-engineered educational platform purpose-built for software engineers, solution architects, and engineering interview candidates. It provides structured, deep-dive learning paths across 30+ engineering domains—including **Low-Level Design (LLD)**, **High-Level Design (HLD)**, **Spring Boot Enterprise Architecture**, **Distributed Microservices**, **Cloud Infrastructure**, and **Generative AI Engineering**.

Unlike traditional LMS applications that rely on opaque CMS databases or rigid video walls, SkillVault implements a **Git-backed, file-system-indexed content architecture**. Course authors write pure, version-controlled Markdown and standalone executable source code. The Spring Boot backend continuously scans, parses, validates, and indexes this hierarchy into a normalized PostgreSQL database, which is served via high-throughput RESTful APIs to an ultra-responsive Next.js web application.

---

## 📸 Screenshots & Visual Tour

### 1. Developer Dashboard & Metrics
The main dashboard displays real-time telemetry, learning metrics, active streak days, and structured category portals with dynamic course counters.
![Developer Dashboard](./docs/images/01-homepage-hero.png)

---

### 2. Featured Engineering Tracks & Curriculums
Curated learning roadmaps covering Backend Architecture, Cloud & DevOps, System Design, and Generative AI.
![Featured Tracks](./docs/images/02-homepage-tracks.png)

---

### 3. Enterprise Course Catalog
Filterable course catalog categorizing 30+ specialized tracks with difficulty levels, estimated hours, and lesson counters.
![Course Catalog](./docs/images/03-course-catalog.png)

---

### 4. Interactive Course Curriculum Syllabus
Comprehensive view of course modules, sub-phases, and lesson outlines with zero clutter or empty sections.
![Course Curriculum](./docs/images/04-course-curriculum.png)

---

### 5. Dual-Sidebar Reading Workspace
An immersive learning environment featuring a **hierarchical curriculum accordion** on the left, an uninterrupted **markdown reader** in the center, and a **real-time heading timeline** on the right.
![Lesson Workspace](./docs/images/05-lesson-reader.png)

---

### 6. High-Contrast Code Syntax Highlighting
Production code snippets with full syntax highlighting across languages (Java, TypeScript, SQL, Bash) with copy-to-clipboard functionality.
![Code Syntax Highlighting](./docs/images/06-java-code-highlighting.png)

---

### 7. Interactive Timeline & Subtopic Deep Linking
Right-hand interactive timeline observes scroll position, tracks completed headings, and enables instant smooth-scrolling to any subtopic.
![Interactive Timeline Navigation](./docs/images/07-timeline-navigation.png)

---

### 8. Spring Boot Live Health & Database Telemetry
Built-in visual health dashboard serving live PostgreSQL connection status, database latency (ping in milliseconds), JVM heap memory utilization, and active content folders.
![Backend Health Dashboard](./docs/images/08-backend-health-dashboard.png)

---

## 🎥 Demo Walkthrough

An end-to-end recorded demonstration showcasing catalog navigation, curriculum browsing, seamless topic switching, interactive timeline tracking, and live syntax highlighting:

![SkillVault Platform Walkthrough](./docs/demo/skillvault-walkthrough.webp)

> *File location: [`docs/demo/skillvault-walkthrough.webp`](./docs/demo/skillvault-walkthrough.webp)*

---

## 🎯 The Problem & The Solution

### The Problem
- **Video Bloat & Low Retention**: Engineers often find video courses inefficient for reviewing complex architectural diagrams, code contracts, and algorithmic invariants.
- **Disconnected Repositories**: Code examples in tutorials are frequently detached from the explanation, out-of-date, or scattered across disparate gists.
- **Slow, Clunky Documentation Portals**: Many LMS tools rely on heavy, bloated CMS stacks with high page-load latency and poor code block rendering.

### The SkillVault Solution
- **Code-First Markdown Workspace**: In-depth explanations paired directly with runnable code implementations (e.g., 108 standalone, compilable Java reference files for all 23 design patterns).
- **Dual Navigation Architecture**: Simultaneous module progress navigation and single-lesson subtopic progression for fast skimming and deep study.
- **Continuous Local & Cloud Synchronization**: Markdown files on disk remain the single source of truth, synchronizing dynamically with the relational database via `POST /api/courses/reindex`.
- **Sub-100ms API Response Times**: In-memory caching on the client, tuned HikariCP database connection pooling, and optimized JPA queries guarantee near-instantaneous page transitions.

---

## 🏗️ System Architecture

SkillVault follows a clean, decoupled client-server architecture with an independent backend service, a modern frontend client, and a modular content repository.

```mermaid
flowchart TB
    subgraph Client["Client Tier (Browser)"]
        UI["Next.js 16 Web Application\n(React 19, Tailwind CSS v4)"]
        Cache["Client-Side In-Memory Cache\n(TTL: 60s)"]
    end

    subgraph Gateway["Next.js Reverse Proxy"]
        Rewrite["next.config.ts API Rewrite\n(/api/* -> Backend:8080)"]
    end

    subgraph Backend["Backend Tier (Spring Boot 4)"]
        direction TB
        REST["REST API Controllers\n(Course, Progress, Search, Practice, Health)"]
        Service["Domain Services\n(CourseService, ProgressService, ContentIndexingService)"]
        Repo["Spring Data JPA Repositories\n(Hibernate ORM)"]
        Hikari["HikariCP Connection Pool\n(Dynamic Cloud URI Parser)"]
    end

    subgraph Storage["Data & Content Tier"]
        DB[(PostgreSQL Database\nCourses, Modules, Lessons, Progress)]
        ContentDir[/"Content Repository (Disk Files)\n30+ Engineering Paths / Markdown + Java"/]
    end

    UI <--> Cache
    UI --> Rewrite
    Rewrite --> REST
    REST --> Service
    Service --> Repo
    Repo --> Hikari
    Hikari <--> DB
    Service <--> ContentDir
```

---

## 🔄 Content Indexing & Data Lifecycle

The platform bridges file-system content and relational queries via an automated indexing pipeline:

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Developer / CI Trigger
    participant API as CourseController
    participant Indexer as ContentIndexingService
    participant Disk as Content File System (/content)
    participant DB as PostgreSQL Database

    Admin->>API: POST /api/courses/reindex
    API->>Indexer: indexContent()
    Indexer->>Disk: Scan Course Folders (e.g., /content/LLD)
    Disk-->>Indexer: Read README.md & Subdirectories

    loop For each Course Directory
        Indexer->>DB: Upsert Course Entity (slug, title, category, hours)
        Indexer->>Disk: Scan Phase Directories (e.g., Phase-01-OOP-Foundations)
        
        loop For each Phase Directory
            Indexer->>Disk: Filter out non-lesson folders (assets, code)
            Indexer->>DB: Upsert CourseModule Entity
            Indexer->>Disk: Read Markdown Files (*.md)
            
            loop For each Markdown File
                Indexer->>Indexer: Extract Title, Order & Summary
                Indexer->>DB: Upsert Lesson Entity (filePath, sortOrder, slug)
            end
        end
        
        Indexer->>DB: Prune Stale / Deleted Lessons & Empty Modules
        Indexer->>DB: Update totalLessons & estimatedHours
    end

    Indexer-->>API: Indexing Complete (34 Courses Processed)
    API-->>Admin: 200 OK ("Reindexing completed successfully")
```

---

## 🗄️ Database Design

The relational schema is normalized to support high-performance catalog querying, hierarchical syllabus trees, full-text title search, and granular user progress tracking.

```mermaid
erDiagram
    COURSES ||--o{ COURSE_MODULES : contains
    COURSE_MODULES ||--o{ LESSONS : contains
    LESSONS ||--o{ USER_PROGRESS : tracks
    LESSONS ||--o{ USER_BOOKMARKS : references

    COURSES {
        bigint id PK
        varchar slug UK "Unique course identifier"
        varchar title "Course name"
        text description "Extracted from README.md"
        varchar category "Backend, Cloud, System Design, AI"
        varchar level "Beginner, Intermediate, Advanced"
        varchar icon "Lucide icon identifier"
        int total_lessons "Calculated on indexing"
        int estimated_hours "Estimated time to complete"
    }

    COURSE_MODULES {
        bigint id PK
        bigint course_id FK
        varchar slug "Module URL slug"
        varchar title "Formatted module title"
        int sort_order "Sequential syllabus order"
    }

    LESSONS {
        bigint id PK
        bigint module_id FK
        varchar slug "Unique lesson slug within course"
        varchar title "Lesson title"
        varchar file_path "Absolute disk path to markdown"
        int sort_order "Position inside module"
        int estimated_minutes "Estimated reading time"
        text summary "Brief summary snippet"
    }

    USER_PROGRESS {
        bigint id PK
        varchar user_identifier "User ID (default-dev)"
        bigint lesson_id FK
        varchar course_slug "Denormalized course reference"
        boolean completed "Completion toggle status"
        timestamp completed_at "Timestamp of completion"
        timestamp last_accessed_at "Last read timestamp"
    }

    USER_BOOKMARKS {
        bigint id PK
        varchar user_identifier "User ID"
        varchar course_slug "Course reference"
        varchar lesson_slug "Lesson reference"
        varchar title "Cached lesson title"
        timestamp created_at "Creation timestamp"
    }
```

---

## 🛠️ Technology Stack

| Layer | Technology | Rationale & Usage |
|---|---|---|
| **Frontend Framework** | **Next.js 16.3 (Turbopack)** | High-speed server rendering, client-side route transitions, and asset bundling. |
| **UI Library** | **React 19.2** | Concurrent rendering, modern hooks (`use`, `useTransition`), and modular component state. |
| **Language** | **TypeScript 5.0** | Strict static typing across API contracts, DTOs, and component interfaces. |
| **Styling** | **Tailwind CSS v4** | Utility-first, zero-runtime modern CSS with curated dark-mode palette. |
| **Icons & Media** | **Lucide React** | Feather-light SVG icons for technical categories, controls, and navigation. |
| **Markdown Engine** | **React-Markdown + Rehype** | Custom AST pipeline rendering markdown with `rehype-highlight`, `rehype-slug`, and `remark-gfm`. |
| **Backend Framework** | **Spring Boot 4.1.1** | Enterprise Java microservice framework with dependency injection, validation, and actuator metrics. |
| **Language & Runtime** | **Java 17 (JDK 17 LTS)** | Records, pattern matching, virtual-thread readiness, and robust concurrency primitives. |
| **Data Access** | **Spring Data JPA / Hibernate 7** | Type-safe repository abstraction, connection lifecycle management, and relationship mapping. |
| **Database Pool** | **HikariCP** | Industry-standard high-performance JDBC connection pool configured with active timeouts. |
| **Database** | **PostgreSQL 15+** | ACID-compliant relational store supporting relational integrity, indices, and transactions. |
| **Cloud Database** | **Neon PostgreSQL** | Serverless cloud PostgreSQL with SSL pooling and instant horizontal scalability. |
| **Containerization** | **Docker (Multi-Stage)** | Multi-stage image packaging JDK build tools and lightweight JRE 17 Alpine runtime. |

---

## 📡 API Reference

All backend endpoints are prefixed with `/api`. When running the Next.js frontend, calls to `/api/*` are transparently proxied to the backend via Next.js rewrites.

### Course & Curriculum Endpoints

| Method | Endpoint | Query / Body | Description |
|---|---|---|---|
| `GET` | `/api/courses` | `?category=Backend` *(optional)* | Retrieve list of all available courses, optionally filtered by category. |
| `GET` | `/api/courses/{slug}` | — | Retrieve comprehensive course metadata, module hierarchy, and lesson summaries. |
| `GET` | `/api/courses/{courseSlug}/lessons/{lessonSlug}` | Header: `X-User-Id` *(optional)* | Fetch complete lesson markdown content, extracted subtopic outline, and completion status. |
| `GET` | `/api/courses/stats/dashboard` | Header: `X-User-Id` *(optional)* | Retrieve high-level metrics: total courses, lessons, completed count, and active streak. |
| `POST` | `/api/courses/reindex` | — | Trigger on-demand file-system scanning and relational database synchronization. |

### Progress & User State Endpoints

| Method | Endpoint | Payload | Description |
|---|---|---|---|
| `POST` | `/api/progress/toggle/{courseSlug}/{lessonSlug}` | — | Toggle the completed state of a lesson for the given user. |
| `GET` | `/api/progress` | `?courseSlug=lld` *(optional)* | Fetch all lesson completion records for the authenticated user. |
| `POST` | `/api/progress/bookmark/{courseSlug}/{lessonSlug}` | `{"title": "Classes and Objects"}` | Add or remove a lesson from user bookmarks. |
| `GET` | `/api/progress/bookmarks` | — | Retrieve all saved bookmarks for the current user. |

### Search & Practice Endpoints

| Method | Endpoint | Query | Description |
|---|---|---|---|
| `GET` | `/api/search` | `?q=singleton` | Multi-entity search across course titles, categories, and lesson titles. |
| `GET` | `/api/practice/quizzes` | — | Fetch interactive quiz modules and self-assessment questions. |
| `GET` | `/api/practice/flashcards` | — | Retrieve flashcard decks for quick review and interview drill practice. |

### System & Health Endpoints

| Method | Endpoint | Response Type | Description |
|---|---|---|---|
| `GET` | `/health` | `application/json` | JSON health probe detailing database status, latency, and course counts. |
| `GET` | `/` | `text/html` | Rich, visual HTML health and operational telemetry dashboard. |

---

## 🚀 Local Development & Getting Started

### Prerequisites
- **Java**: JDK 17 or higher (`java -version`)
- **Maven**: 3.9+ (or use the included `./mvnw` wrapper)
- **Node.js**: 20.x or higher (`node -v`)
- **npm**: 10.x or higher
- **PostgreSQL**: 15+ (local instance or free cloud database like [Neon](https://neon.tech))

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/webdeveloper-fresher32/skillvault-website.git
cd skillvault-website
```

---

### Step 2: Configure Environment Variables

#### Backend Configuration (`backend/src/main/resources/application.yml` or Environment):
The backend automatically connects to a local PostgreSQL instance by default. To point to a cloud database (such as Neon), set:
```bash
export DATABASE_URL="postgresql://<user>:<password>@<host>/<dbname>?sslmode=require"
```

#### Frontend Configuration (`frontend/.env.local`):
Create `frontend/.env.local`:
```env
BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

---

### Step 3: Run the Spring Boot Backend
```bash
cd backend
# Using Maven Wrapper (macOS / Linux):
./mvnw spring-boot:run

# Using Maven on Windows:
# mvnw.cmd spring-boot:run
```
- **Backend API**: `http://localhost:8080`
- **Visual Health Dashboard**: `http://localhost:8080/`
- **JSON Health Endpoint**: `http://localhost:8080/health`

*On first startup, the backend automatically reads the `/content` directory, creates database tables via Hibernate DDL auto-update, and indexes all courses and lessons.*

---

### Step 4: Run the Next.js Frontend
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
- **Web Application**: `http://localhost:3000`
- **Course Catalog**: `http://localhost:3000/courses`
- **LLD Course**: `http://localhost:3000/courses/lld`

---

### Step 5: Containerized Execution (Docker)
The repository includes a production multi-stage `Dockerfile`:
```bash
# Build the backend container image
docker build -t skillvault-backend .

# Run container with connection to PostgreSQL
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://user:password@host:5432/dbname" \
  skillvault-backend
```

---

## 💡 Engineering Highlights & Architectural Decisions

### 1. Git-Backed Markdown on Disk + Relational Indexing
- **Decision**: Avoid storing raw markdown bodies inside database blobs. Instead, maintain markdown files in version-controlled folders and store metadata (slugs, file paths, sort order, summaries) in PostgreSQL.
- **Why**: Content authors can use Git branching, pull requests, diff reviews, and IDE markdown previewing. The backend reads files dynamically using NIO streaming, ensuring that content updates take effect immediately without database migrations.

### 2. Universal Cloud Database Connection String Adapter (`DataSourceConfig`)
- **Challenge**: Cloud providers like Render, Railway, Neon, and Supabase expose database URLs in the standard Unix format (`postgres://user:pass@host:port/db`), which standard JDBC drivers cannot parse directly without throwing syntax exceptions.
- **Solution**: Built a custom `DataSourceConfig` bean that parses `DATABASE_URL`, extracts user credentials, rewrites protocol headers to `jdbc:postgresql://`, attaches SSL parameters, and injects tuned connection pooling settings into HikariCP automatically.

### 3. Dynamic Subtopic Heading Observer Algorithm
- **Challenge**: Reading a 5,000-word design document requires knowing where you are at all times without losing the continuous reading flow.
- **Solution**: Implemented an intersection-based scroll observer on the frontend (`useEffect` in `LessonPage.tsx`) that continuously calculates scroll offsets against all rendered `<h2>` and `<h3>` DOM elements, dynamically highlighting the active step in the right sidebar timeline with sub-16ms frame budgeting.

### 4. Client-Side In-Memory Micro-Caching Layer
- **Challenge**: Navigating between courses and lessons should feel instantaneous without redundant network waterfalls.
- **Solution**: Added a lightweight, in-memory client-side cache (`api.ts`) with a 60-second TTL for course catalogs and lesson metadata. Switching between modules achieves a 0ms perceived latency while preserving real-time progress state updates via `invalidateApiCache()`.

### 5. 100% Compilable Java Reference Implementations
- **Standard**: All 23 design pattern reference examples under `content/LLD/Reference-Code` are written as clean, standalone Java 17 programs. Every class, interface, and test harness compiles with `javac` with zero errors and supports single-file execution (`java GoodExample.java`).

---

## 📂 Repository Directory Structure

```
skillvault-website/
├── .github/                       # GitHub configurations & issue templates
├── backend/                       # Spring Boot 4 REST API Service
│   ├── mvnw / mvnw.cmd            # Maven Wrapper scripts
│   ├── pom.xml                    # Maven dependency management (Java 17, JPA, WebMVC)
│   └── src/
│       ├── main/
│       │   ├── java/com/skillvault/
│       │   │   ├── config/        # DataSourceConfig (Cloud connection parser), WebCorsConfig
│       │   │   ├── controller/    # CourseController, ProgressController, SearchController, RootHealthController
│       │   │   ├── dto/           # DashboardStatsDto, LessonDetailDto, SubtopicSectionDto
│       │   │   ├── model/         # JPA Entities: Course, CourseModule, Lesson, Progress, Bookmark
│       │   │   ├── repository/    # Spring Data JPA interfaces
│       │   │   └── service/       # CourseService, ProgressService, ContentIndexingService
│       │   └── resources/
│       │       └── application.yml# Spring environment configuration
├── frontend/                      # Next.js 16 Web Application
│   ├── package.json               # Dependencies (Next 16, React 19, Tailwind v4, Lucide)
│   ├── next.config.ts             # API proxy rewrites & Turbopack config
│   ├── public/                    # Static favicon and public web assets
│   └── src/
│       ├── app/                   # Next.js App Router (courses, lessons, practice, revision)
│       ├── components/            # MarkdownViewer, TopScrollProgress, UI elements
│       └── lib/                   # api.ts (REST client & micro-cache)
├── content/                       # 30+ Engineering Curriculums & Reference Code
│   ├── LLD/                       # Low-Level Design (14 Modules, 72 Lessons, 108 Java Files)
│   │   ├── Phase-01-OOP-Foundations/
│   │   ├── Phase-02-SOLID-Principles/
│   │   ├── Phase-03-UML-and-Object-Modeling/
│   │   ├── Phase-04-Creational-Patterns/
│   │   ├── Phase-05-Structural-Patterns/
│   │   ├── Phase-06-Behavioral-Patterns/
│   │   ├── Projects/              # Real-world capstones (Parking Lot, Splitwise, Cab Booking)
│   │   └── Reference-Code/        # 108 Standalone Java Design Pattern Implementations
│   ├── HLD/                       # High-Level Distributed System Design
│   ├── SpringBoot/                # Spring Boot Enterprise Architecture
│   ├── Microservices-and-Cloud/   # Microservices Patterns & Cloud Infrastructure
│   ├── DSA/                       # Algorithms & Data Structures
│   └── ...                        # 25+ Additional Full-Stack & Systems Tracks
├── docs/                          # Architectural Documentation & Media Assets
│   ├── demo/                      # Video walkthroughs (.webp, .mp4)
│   └── images/                    # High-resolution platform screenshots
├── Dockerfile                     # Multi-stage production container build definition
└── README.md                      # Primary project portfolio documentation
```

---

## 🛡️ License & Acknowledgements

Developed as an open-source engineering portfolio project to demonstrate mastery of full-stack system architecture, Spring Boot microservices, modern React/Next.js design, and low-level software engineering principles.

Designed and built with ❤️ by **[Ganesh Pirikirala](https://github.com/webdeveloper-fresher32)**.
