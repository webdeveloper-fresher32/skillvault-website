# NestJS Cheatsheet

---

### Nest CLI Commands

```bash
npm i -g @nestjs/cli                       # install CLI globally
nest new my-app                            # scaffold a new project
nest generate module orders                # nest g mo orders
nest generate controller orders            # nest g co orders
nest generate service orders               # nest g s orders
nest generate resource orders              # scaffolds module+controller+service+DTOs+CRUD (REST/GraphQL/WS/microservice prompt)
nest generate guard auth/roles             # nest g gu auth/roles
nest generate interceptor logging          # nest g in logging
nest generate filter http-exception        # nest g f http-exception
nest generate pipe parse-int               # nest g pi parse-int
nest generate decorator current-user       # nest g d current-user
nest generate gateway events                # nest g ga events
nest build                                  # compile to dist/
nest start --watch                          # dev server with hot reload
nest start --debug --watch                  # dev server + inspector
```

---

### Bootstrap & Core Decorators

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();
  app.setGlobalPrefix('api/v1');
  await app.listen(3000);
}
bootstrap();
```

```typescript
@Module({
  imports: [UsersModule, ConfigModule.forRoot()],   // other modules this module depends on
  controllers: [OrdersController],                   // controllers instantiated within this module
  providers: [OrdersService, OrdersRepository],      // providers registered with this module's injector
  exports: [OrdersService],                          // providers made available to modules that import this one
})
export class OrdersModule {}
```

```typescript
@Injectable()                    // marks a class as a provider manageable by Nest's DI container
export class OrdersService { }

@Controller('orders')            // marks a class as a controller, sets a route prefix
export class OrdersController { }
```

| Route decorator | HTTP verb |
|---|---|
| `@Get()` / `@Get(':id')` | GET |
| `@Post()` | POST |
| `@Put(':id')` | PUT |
| `@Patch(':id')` | PATCH |
| `@Delete(':id')` | DELETE |
| `@All()` | any verb |
| `@HttpCode(204)` | override default status code (200, or 201 for POST) |
| `@Header('Cache-Control', 'none')` | set a response header |
| `@Redirect('https://nestjs.com', 301)` | redirect response |

```typescript
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}   // constructor injection

  @Get()
  findAll(@Query('status') status?: string) { ... }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { ... }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateOrderDto) { ... }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) { ... }

  @Delete(':id')
  remove(@Param('id') id: string) { ... }
}
```

| Parameter decorator | Extracts |
|---|---|
| `@Param('id')` | route path parameter |
| `@Query('status')` | query string parameter |
| `@Body()` / `@Body('field')` | request body (whole DTO or one field) |
| `@Headers('authorization')` | request header |
| `@Req()` | raw Express/Fastify request object |
| `@Res()` | raw Express/Fastify response object — **disables Nest's response handling**, see Guards/Filters gotcha below |
| `@Session()` | session object (needs session middleware) |
| `@UploadedFile()` / `@UploadedFiles()` | file(s) from `FileInterceptor`/`FilesInterceptor` |

---

### Provider Registration Patterns

| Pattern | Use case | Example |
|---|---|---|
| `useClass` | Standard class-based provider, or swap implementation per environment | `{ provide: PaymentGateway, useClass: StripeGateway }` |
| `useValue` | Inject a constant, mock, or pre-built object (config, test double) | `{ provide: 'APP_CONFIG', useValue: { retries: 3 } }` |
| `useFactory` | Provider built at runtime, optionally depending on other providers | `{ provide: 'CONNECTION', useFactory: (cfg: ConfigService) => createConn(cfg.get('url')), inject: [ConfigService] }` |
| `useExisting` | Alias one token to an existing provider | `{ provide: 'LegacyLogger', useExisting: LoggerService }` |
| Custom token + `@Inject` | Non-class dependencies (strings/symbols) | `providers: [{ provide: 'CACHE', useValue: cache }]` then `constructor(@Inject('CACHE') private cache) {}` |

```typescript
@Module({
  providers: [
    OrdersService,
    { provide: PaymentGateway, useClass: StripeGateway },
    { provide: 'APP_CONFIG', useValue: { retries: 3 } },
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: async (config: ConfigService) => {
        return createConnection(config.get('DB_URL'));
      },
      inject: [ConfigService],
    },
  ],
})
export class OrdersModule {}
```

---

### DI Scopes

| Scope | Instantiation | Notes |
|---|---|---|
| `Scope.DEFAULT` (singleton) | Once per application | Default — shared instance across every request, fastest |
| `Scope.REQUEST` | Once per incoming request | Needed to access request-specific data (e.g., `REQUEST` token); has a real perf cost — see gotchas |
| `Scope.TRANSIENT` | New instance every time it's injected | Each consumer gets its own private instance |

```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}
}
```

**Scope bubbling:** a provider's scope is inherited upward — if `OrdersService` is `REQUEST`-scoped and `OrdersController` injects it, the controller itself becomes request-scoped too (re-instantiated per request), since Nest must build the whole dependency graph fresh for each request whenever any node in it is request-scoped.

---

### Pipes & class-validator

```typescript
// Built-in pipes
@Param('id', ParseIntPipe) id: number
@Param('id', ParseUUIDPipe) id: string
@Query('active', ParseBoolPipe) active: boolean
@Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })) dto: CreateOrderDto
@Param('status', new ParseEnumPipe(OrderStatus)) status: OrderStatus
@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
```

```typescript
// main.ts — global validation pipe (applies to every controller)
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // strips properties not declared on the DTO
  forbidNonWhitelisted: true, // throws instead of silently stripping
  transform: true,            // auto-transforms payloads into typed DTO instances
}));
```

```typescript
import { Type } from 'class-transformer';
import { IsString, IsEmail, IsInt, Min, IsOptional, ValidateNested, IsArray } from 'class-validator';

export class OrderItemDto {
  @IsString() sku: string;
  @IsInt() @Min(1) quantity: number;
}

export class CreateOrderDto {
  @IsString() customerName: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() notes?: string;

  @IsArray()
  @ValidateNested({ each: true })    // required — without this, nested object validation is silently skipped
  @Type(() => OrderItemDto)          // required — tells class-transformer what class to instantiate for each item
  items: OrderItemDto[];
}
```

| Decorator | Validates |
|---|---|
| `@IsString()` / `@IsNumber()` / `@IsBoolean()` | primitive type |
| `@IsEmail()` / `@IsUUID()` / `@IsUrl()` | format |
| `@IsNotEmpty()` / `@IsOptional()` | presence |
| `@Min(n)` / `@Max(n)` | numeric bounds |
| `@Length(min, max)` / `@MinLength()` / `@MaxLength()` | string length |
| `@IsEnum(EnumType)` | value in enum |
| `@IsArray()` + `@ValidateNested({ each: true })` + `@Type(() => Dto)` | array of nested DTOs |
| `@IsDateString()` | ISO date string |
| `@Matches(/regex/)` | custom pattern |

---

### Guards, @Roles & @CurrentUser

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}   // Passport-based guard

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

```typescript
// Custom metadata decorator for roles
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Custom param decorator to pull the authenticated user off the request
export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);
```

```typescript
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)   // executed left to right: JwtAuthGuard first, then RolesGuard
export class OrdersController {
  @Get('mine')
  findMine(@CurrentUser() user: User) { ... }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) { ... }
}
```

Guard execution order: global guards (from `app.useGlobalGuards()`) → controller-level `@UseGuards` → method-level `@UseGuards`, each running in the order listed; **any guard returning `false` short-circuits the request immediately** — no later guard, interceptor, or the handler itself runs.

---

### Interceptors & Exception Filters

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`${context.getClass().name} took ${Date.now() - start}ms`)),
    );
  }
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { data: T }> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<{ data: T }> {
    return next.handle().pipe(map((data) => ({ data })));
  }
}
```

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
      message: exception.message,
    });
  }
}

@Catch()   // no arg = catches everything, including non-HttpException errors
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) { ... }
}
```

```typescript
@UseInterceptors(LoggingInterceptor)
@UseFilters(HttpExceptionFilter)
@Controller('orders')
export class OrdersController { }

// main.ts — global registration
app.useGlobalInterceptors(new LoggingInterceptor());
app.useGlobalFilters(new AllExceptionsFilter());
```

**Request pipeline order:** Middleware → Guards → Interceptors (pre-controller) → Pipes → Route handler → Interceptors (post-controller, response transform) → Exception Filters (only if something threw).

`@Res()` opts the handler out of Nest's automatic response handling (serialization, interceptors' response-side logic, filter-produced bodies unless you replicate them manually) — once injected, you're responsible for calling `res.json()`/`res.send()` yourself; use `@Res({ passthrough: true })` to keep Nest's default handling while still accessing the response object for things like setting cookies.

---

### TypeORM vs Prisma — Side-by-Side

```typescript
// ---------- TypeORM ----------
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) orderNumber: string;
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING }) status: OrderStatus;
  @ManyToOne(() => Customer, (c) => c.orders) customer: Customer;
  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true }) items: OrderItem[];
  @CreateDateColumn() createdAt: Date;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly repo: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  findAll() { return this.repo.find({ relations: ['customer', 'items'] }); }
  findOne(id: number) { return this.repo.findOneBy({ id }); }
  create(dto: CreateOrderDto) { return this.repo.save(this.repo.create(dto)); }

  async placeOrder(dto: CreateOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.save(Order, dto);
      await manager.update(Inventory, dto.itemId, { qty: () => 'qty - 1' });
      return order;
    });
  }
}

// Module wiring
TypeOrmModule.forRoot({ type: 'postgres', url: process.env.DB_URL, autoLoadEntities: true, synchronize: false });
TypeOrmModule.forFeature([Order]);   // registers Repository<Order> for injection in this module
```

```typescript
// ---------- Prisma ----------
// schema.prisma
model Order {
  id          Int      @id @default(autoincrement())
  orderNumber String   @unique
  status      Status   @default(PENDING)
  customer    Customer @relation(fields: [customerId], references: [id])
  customerId  Int
  items       OrderItem[]
  createdAt   DateTime @default(now())
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() { return this.prisma.order.findMany({ include: { customer: true, items: true } }); }
  findOne(id: number) { return this.prisma.order.findUnique({ where: { id } }); }
  create(dto: CreateOrderDto) { return this.prisma.order.create({ data: dto }); }

  async placeOrder(dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ data: dto });
      await tx.inventory.update({ where: { id: dto.itemId }, data: { qty: { decrement: 1 } } });
      return order;
    });
  }
}
```

| Concern | TypeORM | Prisma |
|---|---|---|
| Schema source of truth | Decorated entity classes | `schema.prisma` file, generates a typed client |
| Migrations | `typeorm migration:generate` / `:run` | `prisma migrate dev` / `prisma migrate deploy` |
| Query style | `Repository`/`QueryBuilder`, Active Record optional | Fully generated fluent client, no raw repository pattern |
| Transactions | `dataSource.transaction()` or `QueryRunner` | `prisma.$transaction([...])` or interactive callback form |
| Nest integration | `@nestjs/typeorm` — `@InjectRepository()` | Community pattern — inject a `PrismaService` singleton directly |

---

### Testing

```typescript
// Unit test with mocked provider
describe('OrdersService', () => {
  let service: OrdersService;
  let repo: jest.Mocked<Repository<Order>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: { find: jest.fn(), save: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    repo = module.get(getRepositoryToken(Order));
  });

  it('returns all orders', async () => {
    repo.find.mockResolvedValue([{ id: 1 } as Order]);
    expect(await service.findAll()).toHaveLength(1);
  });
});
```

```typescript
// Controller test — mocking the service, not the repository
describe('OrdersController', () => {
  let controller: OrdersController;
  const mockService = { findAll: jest.fn(), create: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('delegates to the service', async () => {
    mockService.findAll.mockResolvedValue([]);
    expect(await controller.findAll()).toEqual([]);
  });
});
```

```typescript
// e2e test (Supertest against a real bootstrapped app)
describe('OrdersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  it('/orders (GET)', () => {
    return request(app.getHttpServer())
      .get('/orders')
      .expect(200)
      .expect((res) => expect(Array.isArray(res.body)).toBe(true));
  });

  afterAll(async () => { await app.close(); });
});
```

`overrideProvider()` lets a full `Test.createTestingModule({ imports: [AppModule] })` swap out one real provider for a mock without redeclaring the whole module graph:

```typescript
const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(OrdersService)
  .useValue(mockService)
  .compile();
```

---

### WebSocket Gateways

```typescript
@WebSocketGateway({ cors: true, namespace: '/orders' })
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) { console.log(`Client connected: ${client.id}`); }
  handleDisconnect(client: Socket) { console.log(`Client disconnected: ${client.id}`); }

  @SubscribeMessage('orderStatusUpdate')
  handleStatusUpdate(
    @MessageBody() payload: { orderId: string; status: string },
    @ConnectedSocket() client: Socket,
  ): void {
    this.server.emit('orderStatusChanged', payload);   // broadcast to all connected clients
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
    client.join(room);
    return { event: 'joinedRoom', data: room };          // acknowledgement returned to the emitting client
  }
}
```

```typescript
@Module({
  providers: [OrdersGateway, OrdersService],
})
export class OrdersModule {}
```

---

### Common CLI Generator Reference

| Command | Shortcut | Generates |
|---|---|---|
| `nest g module <name>` | `nest g mo <name>` | Feature module |
| `nest g controller <name>` | `nest g co <name>` | Controller + spec file |
| `nest g service <name>` | `nest g s <name>` | Service + spec file |
| `nest g resource <name>` | — | Full CRUD scaffold (module, controller, service, DTOs, entity) |
| `nest g guard <name>` | `nest g gu <name>` | Guard |
| `nest g interceptor <name>` | `nest g in <name>` | Interceptor |
| `nest g filter <name>` | `nest g f <name>` | Exception filter |
| `nest g pipe <name>` | `nest g pi <name>` | Pipe |
| `nest g decorator <name>` | `nest g d <name>` | Custom param decorator |
| `nest g gateway <name>` | `nest g ga <name>` | WebSocket gateway |
| `nest g class <name>` | `nest g cl <name>` | Plain class (e.g. entity/DTO) |
| `nest g interface <name>` | `nest g itf <name>` | Interface |
| `--no-spec` | flag | skip generating the `.spec.ts` test file |
| `--flat` | flag | skip creating a dedicated subfolder |
