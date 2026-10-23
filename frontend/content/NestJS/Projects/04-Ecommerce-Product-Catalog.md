# Project 4 — E-commerce Product Catalog (Database & Testing)

**Level:** Intermediate-Advanced
**Time estimate:** 5 – 6 hours
**Phase prerequisite:** Phase 9-10 – Database Integration & Testing

---

## Overview

You will build a relational `Category` / `Product` / `Order` / `OrderItem` domain with TypeORM, add filtered/paginated search, and — the focus of this project — a **full Jest test pyramid**:

1. **Unit tests** for `ProductsService` with the TypeORM repository mocked via `getRepositoryToken`.
2. **e2e tests** using `@nestjs/testing`'s `Test.createTestingModule` bootstrapping the real `AppModule` against an in-memory SQLite database, driven with **Supertest**.

By the end you will be able to explain the difference between "test the service in isolation" and "test the whole HTTP request/response cycle" — and why NestJS's `Test.createTestingModule` makes both natural.

---

## Prerequisites

- Completed Project 2 (TypeORM entities, relations, services)
- Node.js 18+, Nest CLI
- Familiarity with Jest basics (`describe`/`it`/`expect`)

---

## Project Structure

```
04-ecommerce-catalog/
├── package.json
├── jest.config.js
├── test/
│   └── products.e2e-spec.ts
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── categories/
    │   ├── categories.module.ts
    │   ├── categories.service.ts
    │   └── entities/
    │       └── category.entity.ts
    ├── products/
    │   ├── products.module.ts
    │   ├── products.controller.ts
    │   ├── products.service.ts
    │   ├── products.service.spec.ts
    │   ├── dto/
    │   │   ├── create-product.dto.ts
    │   │   └── search-products.dto.ts
    │   └── entities/
    │       └── product.entity.ts
    └── orders/
        ├── orders.module.ts
        ├── orders.service.ts
        └── entities/
            ├── order.entity.ts
            └── order-item.entity.ts
```

---

## Step-by-Step Instructions

### Step 1 — Install dependencies

```bash
nest new 04-ecommerce-catalog --package-manager npm
cd 04-ecommerce-catalog
npm install @nestjs/typeorm typeorm sqlite3
npm install class-validator class-transformer
npm install -D supertest @types/supertest
```

### Step 2 — Entities

`src/categories/entities/category.entity.ts`

```typescript
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from '../../products/entities/product.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];
}
```

`src/products/entities/product.entity.ts`

```typescript
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: string; // TypeORM returns decimals as strings by default — kept explicit here on purpose

  @Column({ default: 0 })
  stockQuantity: number;

  @ManyToOne(() => Category, (category) => category.products, { eager: true })
  category: Category;

  @Column()
  categoryId: string;
}
```

`src/orders/entities/order.entity.ts`

```typescript
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PLACED = 'PLACED',
  SHIPPED = 'SHIPPED',
  CANCELLED = 'CANCELLED',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customerEmail: string;

  @Column({ type: 'varchar', default: OrderStatus.PLACED })
  status: OrderStatus;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @CreateDateColumn()
  placedAt: Date;
}
```

`src/orders/entities/order-item.entity.ts`

```typescript
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @ManyToOne(() => Product, { eager: true })
  product: Product;

  @Column()
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: string;
}
```

### Step 3 — Search DTO and dynamic query builder

`src/products/dto/search-products.dto.ts`

```typescript
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SearchProductsDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inStockOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;
}
```

`src/products/dto/create-product.dto.ts`

```typescript
import { IsInt, IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateProductDto {
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsInt()
  @Min(0)
  stockQuantity: number;

  @IsUUID()
  categoryId: string;
}
```

### Step 4 — Products service with query builder search

`src/products/products.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productsRepository: Repository<Product>,
  ) {}

  create(dto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create({
      ...dto,
      price: dto.price.toFixed(2),
    });
    return this.productsRepository.save(product);
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }
    return product;
  }

  async search(dto: SearchProductsDto): Promise<PaginatedResult<Product>> {
    const qb = this.productsRepository.createQueryBuilder('product');

    if (dto.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId: dto.categoryId });
    }
    if (dto.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: dto.minPrice });
    }
    if (dto.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: dto.maxPrice });
    }
    if (dto.inStockOnly) {
      qb.andWhere('product.stockQuantity > 0');
    }

    const [items, total] = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getManyAndCount();

    return { items, total, page: dto.page, limit: dto.limit };
  }
}
```

`src/products/products.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { SearchProductsDto } from './dto/search-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  search(@Query() dto: SearchProductsDto) {
    return this.productsService.search(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }
}
```

`src/products/products.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

### Step 5 — Unit tests with a mocked repository

`src/products/products.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

// Only stub the repository methods this service actually calls.
type MockRepo = Partial<Record<keyof Repository<Product>, jest.Mock>>;

const createMockRepository = (): MockRepo => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let repository: MockRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: createMockRepository() },
      ],
    }).compile();

    service = module.get(ProductsService);
    repository = module.get(getRepositoryToken(Product));
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('formats price to two decimal places and saves', async () => {
      const dto = { name: 'Mug', price: 9.999, stockQuantity: 10, categoryId: 'cat-1' };
      repository.create!.mockReturnValue({ ...dto, price: '10.00' });
      repository.save!.mockResolvedValue({ id: 'p-1', ...dto, price: '10.00' });

      const result = await service.create(dto as any);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ price: '10.00' }),
      );
      expect(result.id).toBe('p-1');
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      repository.findOne!.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
    });

    it('returns the product when found', async () => {
      const product = { id: 'p-1', name: 'Mug' };
      repository.findOne!.mockResolvedValue(product);

      await expect(service.findOne('p-1')).resolves.toEqual(product);
    });
  });

  describe('search', () => {
    it('applies category and inStockOnly filters via the query builder', async () => {
      const qbMock = {
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: 'p-1' }], 1]),
      };
      repository.createQueryBuilder!.mockReturnValue(qbMock);

      const result = await service.search({
        categoryId: 'cat-1',
        inStockOnly: true,
        page: 1,
        limit: 20,
      } as any);

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'product.categoryId = :categoryId',
        { categoryId: 'cat-1' },
      );
      expect(qbMock.andWhere).toHaveBeenCalledWith('product.stockQuantity > 0');
      expect(result).toEqual({ items: [{ id: 'p-1' }], total: 1, page: 1, limit: 20 });
    });
  });
});
```

### Step 6 — e2e test against a real in-memory SQLite database

`test/products.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { ProductsModule } from '../src/products/products.module';
import { Product } from '../src/products/entities/product.entity';
import { Category } from '../src/categories/entities/category.entity';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let categoryId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:', // fresh, isolated DB per test run
          entities: [Product, Category],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Category]),
        ProductsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Seed a category directly via the repository so the test has a real FK to use.
    const categoryRepo = moduleFixture.get('CategoryRepository') ??
      app.get(require('@nestjs/typeorm').getRepositoryToken(Category));
    const category = await categoryRepo.save(categoryRepo.create({ name: 'Kitchen' }));
    categoryId = category.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /products creates a product', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Mug', price: 12.5, stockQuantity: 5, categoryId })
      .expect(201);

    expect(response.body.name).toBe('Mug');
    expect(response.body.price).toBe('12.50');
  });

  it('POST /products rejects an invalid payload', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({ name: '', price: -1, stockQuantity: 5, categoryId })
      .expect(400);
  });

  it('GET /products?inStockOnly=true filters out-of-stock items', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .send({ name: 'Out of stock plate', price: 5, stockQuantity: 0, categoryId });

    const response = await request(app.getHttpServer())
      .get('/products')
      .query({ inStockOnly: 'true' })
      .expect(200);

    expect(response.body.items.every((p: any) => p.stockQuantity > 0)).toBe(true);
  });

  it('GET /products/:id returns 404 for a missing product', async () => {
    await request(app.getHttpServer())
      .get('/products/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});
```

### Step 7 — Jest configuration for e2e

`test/jest-e2e.json` (Nest CLI generates this by default; confirm it matches)

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

### Step 8 — Root module

`src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { Category } from './categories/entities/category.entity';
import { Product } from './products/entities/product.entity';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'ecommerce.sqlite',
      entities: [Category, Product, Order, OrderItem],
      synchronize: true,
    }),
    CategoriesModule,
    ProductsModule,
    OrdersModule,
  ],
})
export class AppModule {}
```

---

## How to Verify It Works

| Check | Command | Expected result |
|-------|---------|-----------------|
| Unit tests pass | `npm run test -- products.service.spec.ts` | All `ProductsService` specs green, no real database touched |
| e2e tests pass | `npm run test:e2e` | All `products.e2e-spec.ts` specs green against `:memory:` SQLite |
| Coverage report | `npm run test:cov` | Coverage report generated; `ProductsService` shows high branch coverage on `search()` |
| Manual smoke test | `npm run start:dev` then `curl "http://localhost:3000/products?minPrice=10&inStockOnly=true"` | `200 OK`, filtered/paginated JSON |
| Validation on search | `curl "http://localhost:3000/products?minPrice=abc"` | `400 Bad Request` (transform/validate coerces and rejects non-numeric) |

---

## Stretch Goals

1. **Orders service + test** — implement `OrdersService.placeOrder()` (decrement stock, compute total) and write both a unit test (mocked repos) and an e2e test for it.
2. **Testcontainers-style Postgres e2e** — swap the e2e SQLite database for a real Postgres instance spun up via `docker run` in a `pretest:e2e` npm script, to catch dialect-specific SQL bugs `createQueryBuilder` might hide.
3. **Controller-level tests** — add `products.controller.spec.ts` using `Test.createTestingModule` with `ProductsService` itself mocked, to test only the HTTP-adapter behavior in isolation from the service.
4. **Category CRUD + cascading delete test** — write an e2e test asserting that deleting a category with existing products is rejected (or cascades, depending on your chosen `onDelete` behavior).
5. **CI script** — add an npm script `test:all` that runs unit tests, e2e tests, and a coverage threshold check (`--coverage --coverageThreshold`), suitable for wiring into a GitHub Actions workflow.
