---
name: nestjs
description: Enterprise NestJS 11+ backend architecture with modules, providers, controllers, pipes, guards, interceptors, microservices, WebSockets, queues, and production-grade patterns. Use when building, refactoring, or reviewing NestJS server-side code, APIs, or services.
metadata:
  stack: nestjs-11
  scope: backend
  version: "11.1"
---

# NestJS 11 Enterprise Architecture Guide

## Overview

NestJS is a progressive Node.js framework for building enterprise-grade server-side applications. It uses TypeScript, follows MVC patterns, and provides out-of-the-box support for dependency injection, modular architecture, and microservices.

### When to Use NestJS
- Complex REST/GraphQL APIs with multiple modules
- Microservices requiring consistent patterns
- Applications needing strict TypeScript typing
- Teams familiar with Angular-style architecture
- Systems requiring WebSocket, gRPC, or event-driven patterns

### Alternatives Considered
| Framework | Pros | Cons | When to Choose NestJS |
|-----------|------|------|----------------------|
| Express | Simple, minimal | No structure, manual DI | Need structured architecture |
| Fastify | Fast, schema-based | Less ecosystem | Need raw speed only |
| AdonisJS | Full-stack | Smaller community | Need batteries-included |
| tRPC | Type-safe | TypeScript-only | Need full-stack type safety |

---

## Architecture Patterns

### Layered Architecture
```
src/
├── main.ts                          # Bootstrap
├── app.module.ts                    # Root module
├── config/                          # Configuration
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── auth.config.ts
├── common/                          # Shared utilities
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   ├── current-user.decorator.ts
│   │   └── api-paginated.decorator.ts
│   ├── filters/
│   │   ├── all-exceptions.filter.ts
│   │   └── prisma-exception.filter.ts
│   ├── guards/
│   │   ├── roles.guard.ts
│   │   ├── jwt-auth.guard.ts
│   │   └── throttle.guard.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   ├── transform.interceptor.ts
│   │   ├── timeout.interceptor.ts
│   │   └── cache.interceptor.ts
│   ├── pipes/
│   │   ├── zod-validation.pipe.ts
│   │   └── parse-objectid.pipe.ts
│   ├── dto/
│   │   ├── pagination.dto.ts
│   │   └── api-response.dto.ts
│   └── types/
│       └── index.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   └── register.dto.ts
│   │   ├── guards/
│   │   │   ├── local-auth.guard.ts
│   │   │   └── jwt-auth.guard.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── local.strategy.ts
│   │   └── entities/
│   │       └── session.entity.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── dto/
│   │   ├── entities/
│   │   └── users.repository.ts
│   ├── payments/
│   │   ├── payments.module.ts
│   │   ├── payments.controller.ts
│   │   ├── payments.service.ts
│   │   ├── processors/
│   │   │   └── payment.processor.ts
│   │   └──dto/
│   └── notifications/
│       ├── notifications.module.ts
│       ├── notifications.service.ts
│       └── notifications.gateway.ts
├── prisma/
│   ├── prisma.module.ts
│   ├── prisma.service.ts
│   └── prisma-exception.filter.ts
└── health/
    ├── health.module.ts
    ├── health.controller.ts
    └── indicators/
        ├── database.indicator.ts
        ├── redis.indicator.ts
        └── memory.indicator.ts
```

### Module Pattern (Feature Module)
```typescript
// users/users.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule), // Circular dependency handling
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersRepository,
  ],
  exports: [UsersService], // Export for other modules
})
export class UsersModule {}
```

### Repository Pattern
```typescript
// users/users.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    const { skip, take, where, orderBy } = params;
    return this.prisma.user.findMany({ skip, take, where, orderBy });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.prisma.user.count({ where });
  }
}
```

### Service Pattern (Business Logic)
```typescript
// users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoggerService } from '../../common/services/logger.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly logger: LoggerService,
  ) {}

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.repository.findAll({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.repository.count(),
    ]);

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.repository.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already exists');

    this.logger.log('Creating user', { email: dto.email });
    return this.repository.create(dto);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id); // Ensure exists
    return this.repository.update(id, dto);
  }

  async remove(id: string) {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
```

---

## Complete Configuration

### Bootstrap (main.ts) - Production Ready
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: false, // Handle CORS explicitly
  });

  // Logging
  app.useLogger(app.get(Logger));

  // Security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  }));

  // Compression
  app.use(compression());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  // Global Prefix (alternative to versioning)
  // app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Graceful Shutdown
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  await app.listen(port);
  console.log(`Application running on port ${port}`);
}
bootstrap();
```

### Prisma Service (Enhanced)
```typescript
// prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
      errorFormat: 'colorless',
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');

    // Query logging in development
    if (process.env.NODE_ENV === 'development') {
      this.$on('query', (e: Prisma.QueryEvent) => {
        this.logger.debug(`Query: ${e.query} [${e.duration}ms]`);
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  // Transaction helper with retry
  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; retries?: number },
  ): Promise<T> {
    const { maxWait = 5000, timeout = 10000, retries = 3 } = options || {};

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.$transaction(fn, { maxWait, timeout });
      } catch (error) {
        if (attempt === retries) throw error;
        this.logger.warn(`Transaction attempt ${attempt} failed, retrying...`);
        await new Promise((r) => setTimeout(r, 100 * attempt));
      }
    }
    throw new Error('Transaction failed after retries');
  }

  // Clean database (for testing)
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    const models = Prisma.dmmf.datamodel.models;
    for (const model of models) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${model.name}" CASCADE`);
    }
  }
}
```

### Zod Validation Pipe
```typescript
// common/pipes/zod-validation.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
```

### Custom Decorators
```typescript
// common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// common/decorators/api-paginated.decorator.ts
import { applyDecorators, Query } from '@nestjs/common';
import { PaginationDto } from '../dto/pagination.dto';

export function ApiPaginated() {
  return applyDecorators(
    Query(new ZodValidationPipe(PaginationSchema))
  );
}
```

### Exception Filters (Production)
```typescript
// common/filters/all-exceptions.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      message = typeof exResponse === 'string' ? exResponse : (exResponse as any).message;
      errors = (exResponse as any).errors;
    }

    // Log error with context
    this.logger.error(
      `${request.method} ${request.url} ${status}`,
      exception instanceof Error ? exception.stack : '',
    );

    // Don't expose internal errors in production
    if (status === HttpStatus.INTERNAL_SERVER_ERROR && process.env.NODE_ENV === 'production') {
      message = 'Internal server error';
      errors = undefined;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      errors,
      ...(process.env.NODE_ENV !== 'production' && {
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    });
  }
}

// common/filters/prisma-exception.filter.ts
import { Catch, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002':
        throw new ConflictException(`Unique constraint violation: ${exception.meta?.target}`);
      case 'P2025':
        throw new NotFoundException('Record not found');
      default:
        throw exception;
    }
  }
}
```

---

## Security Hardening

### Authentication (JWT Strategy)
```typescript
// auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; roles: string[] }) {
    // Additional validation (check if user exists, is active, etc.)
    if (!payload.sub) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, email: payload.email, roles: payload.roles };
  }
}

// common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    // Check for wildcard admin role
    if (user.roles?.includes('admin')) {
      return true;
    }

    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}

// common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### Rate Limiting (Multi-Tier)
```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'global', ttl: 60000, limit: 100 },       // 100 req/min
        { name: 'auth', ttl: 900000, limit: 5 },           // 5 req/15min (login)
        { name: 'api', ttl: 60000, limit: 60 },            // 60 req/min (API)
        { name: 'export', ttl: 3600000, limit: 10 },       // 10 req/hour (exports)
      ],
      storage: redisStorageProvider, // Use Redis for distributed rate limiting
      skipIf: (context) => {
        const req = context.switchToHttp().getRequest();
        return req.headers['x-internal-request'] === process.env.INTERNAL_API_KEY;
      },
    }),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

// In controller
@Throttle({ auth: { limit: 3, ttl: 60000 } }) // Override: 3 login attempts per minute
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

### Helmet Configuration
```typescript
// main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.API_URL],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
```

---

## Performance Optimization

### Connection Pooling (Prisma)
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // connection_limit = 10  // Default: num_cores * 2 + 1
  // pool_timeout = 10      // seconds
}

// Environment variable
// DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"
```

### Caching Interceptor
```typescript
// common/interceptors/cache.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../../modules/redis/redis.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const key = `cache:${request.method}:${request.url}`;

    return new Observable((subscriber) => {
      this.redis.get(key).then((cached) => {
        if (cached) {
          subscriber.next(JSON.parse(cached));
          subscriber.complete();
        } else {
          next.handle().pipe(
            tap((data) => {
              this.redis.set(key, JSON.stringify(data), 'EX', 60); // 1 min TTL
            }),
          ).subscribe(subscriber);
        }
      });
    });
  }
}
```

### Response Transformation
```typescript
// common/interceptors/transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}

// Timeout interceptor
import { TimeoutInterceptor } from '@nestjs/common';
import { timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(timeout(30000)); // 30 second timeout
  }
}
```

---

## Integration Patterns

### NestJS + BullMQ (Job Queue)
```typescript
// payments/payments.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('payments')
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id}: ${job.name}`);

    switch (job.name) {
      case 'process-payment':
        return this.processPayment(job);
      case 'refund-payment':
        return this.refundPayment(job);
      case 'send-receipt':
        return this.sendReceipt(job);
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  }

  private async processPayment(job: Job) {
    const { orderId, amount, currency } = job.data;

    await job.updateProgress(10);
    // Validate payment
    await this.validatePayment(orderId);

    await job.updateProgress(50);
    // Process with payment gateway
    const result = await this.chargePayment(amount, currency);

    await job.updateProgress(100);
    return result;
  }
}

// payments/payments.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectQueue('payments') private paymentsQueue: Queue,
  ) {}

  async processPayment(orderId: string, amount: number) {
    const job = await this.paymentsQueue.add('process-payment', {
      orderId,
      amount,
      currency: 'USD',
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    });

    return { jobId: job.id };
  }
}
```

### NestJS + Socket.IO (Real-time)
```typescript
// notifications/notifications.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGINS?.split(',') },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    client.join(roomId);
    return { event: 'room-joined', data: roomId };
  }

  // Emit to specific user
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Broadcast to room
  broadcastToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }
}
```

### NestJS + Redis (Distributed)
```typescript
// modules/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: Redis,
      useFactory: () => new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          return Math.min(times * 50, 2000);
        },
      }),
    },
    RedisService,
  ],
  exports: [Redis, RedisService],
})
export class RedisModule {}
```

---

## Anti-Patterns

### ❌ God Module
```typescript
// BAD: Everything in one module
@Module({
  imports: [DatabaseModule, AuthModule, PaymentModule, EmailModule, ...],
  controllers: [UsersController, OrdersController, PaymentsController, ...],
  providers: [UsersService, OrdersService, PaymentsService, ...],
})
export class AppModule {}
```

### ✅ Feature Modules
```typescript
// GOOD: Each feature is a module
@Module({
  imports: [UsersModule, OrdersModule, PaymentsModule],
})
export class AppModule {}
```

### ❌ Business Logic in Controllers
```typescript
// BAD
@Controller('users')
export class UsersController {
  @Post()
  async create(@Body() dto: CreateUserDto) {
    // Business logic in controller
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email exists');
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({ data: { ...dto, password: hashedPassword } });
  }
}
```

### ✅ Service Layer
```typescript
// GOOD
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

### ❌ Circular Dependencies Without forwardRef
```typescript
// BAD
@Module({
  imports: [AuthModule], // AuthModule also imports UsersModule
})
export class UsersModule {}
```

### ✅ Use forwardRef
```typescript
// GOOD
@Module({
  imports: [forwardRef(() => AuthModule)],
})
export class UsersModule {}
```

---

## Anti-Patterns FinPay

### ❌ Queries sem organizationId
```typescript
// ❌ Viola tenant isolation
const users = await this.prisma.user.findMany();
const payments = await this.prisma.payment.findMany({ where: { status: 'PENDING' } });
```

### ✅ Queries com organizationId
```typescript
// ✅ Tenant isolation garantido
const users = await this.prisma.user.findMany({ where: { organizationId } });
const payments = await this.prisma.payment.findMany({ where: { organizationId, status: 'PENDING' } });
```

### ❌ Health Endpoint com Vazamento
```typescript
// ❌ Expõe informação sensível
@Get('health')
health() {
  return {
    status: 'ok',
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}
```

### ✅ Health Endpoint Seguro
```typescript
// ✅ Apenas status básico
@Get('health')
health() {
  return { status: 'ok' };
}
```

### ❌ Logs com PII Não Redactada
```typescript
// ❌ Logs dados sensiveis
this.logger.log(`User created: ${user.email} - ${user.phone}`);
this.logger.log(`Payment: ${payment.cardNumber}`);
```

### ✅ Logs com PII Redactada
```typescript
// ✅ Dados sensiveis redactados
this.logger.log(`User created: ${maskEmail(user.email)}`);
this.logger.log(`Payment: ${maskCard(payment.cardNumber)}`);
```

### ❌ Rate Limiting Ausente
```typescript
// ❌ Sem protecção contra brute force
@Post('login')
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

### ✅ Rate Limiting Aplicado
```typescript
// ✅ Protecção adequada
@Post('login')
@UseGuards(RateLimiterGuard)
@RateLimiter({ points: 5, duration: 60 }) // 5 tentativas por minuto
async login(@Body() dto: LoginDto) {
  return this.authService.login(dto);
}
```

### ❌ Auth Bypass em Rotas oRPC
```typescript
// ❌ Rota protegida sem verificação
@Query('payment')
async getPayment(@Input() input: GetPaymentInput) {
  return this.paymentService.getPayment(input);
}
```

### ✅ Auth com RBAC por Rota
```typescript
// ✅ Rota protegida com permissões
@Query('payment')
@UseGuards(AuthGuard, RolesGuard)
@Roles('payment:read')
async getPayment(@Input() input: GetPaymentInput, @OrgId() organizationId: string) {
  return this.paymentService.getPayment(input, organizationId);
}
```

### ❌ Business Logic em Controllers
```typescript
// ❌ Lógica de negócio no controller
@Post('payment')
async createPayment(@Body() dto: CreatePaymentDto) {
  const intent = await this.prisma.paymentIntent.create({ data: dto });
  const compliance = await this.checkCompliance(intent);
  if (compliance.blocked) throw new ForbiddenException();
  return this.processPayment(intent);
}
```

### ✅ Business Logic em Services
```typescript
// ✅ Controller fino, service rico
@Post('payment')
async createPayment(@Body() dto: CreatePaymentDto, @OrgId() orgId: string) {
  return this.paymentService.create(dto, orgId);
}
```

---

## Troubleshooting

### Common Issues

**1. Circular Dependency Error**
```
Nest can't resolve dependencies of the UsersService, AuthService
```
Solution: Use `forwardRef()` or restructure modules.

**2. "Cannot read property of undefined" in Guards**
Solution: Ensure guard runs after authentication middleware.

**3. Slow Queries in Production**
Solution: Enable Prisma query logging, add `@prisma/client` extensions for tracing.

**4. WebSocket Connection Drops**
Solution: Configure `pingTimeout` and `pingInterval` in Socket.IO options.

**5. Memory Leak with Large Payloads**
Solution: Use streaming responses, implement pagination.

---

## Observability

### Structured Logging (nestjs-pino)
```typescript
// main.ts
import { Logger } from 'nestjs-pino';

const app = await NestFactory.create(AppModule, {
  bufferLogs: true,
});
app.useLogger(app.get(Logger));

// Custom logger in service
import { LoggerService } from '@nestjs/common';

@Injectable()
export class CustomLogger implements LoggerService {
  log(message: string, context?: string) {
    // Structured logging to external service
  }
  error(message: string, trace?: string, context?: string) {}
  warn(message: string, context?: string) {}
  debug(message: string, context?: string) {}
  verbose(message: string, context?: string) {}
}
```

### Health Checks
```typescript
// health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './indicators/database.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.isHealthy('database'),
      // () => this.redis.isHealthy('redis'),
      // () => this.memory.isHealthy('memory'),
    ]);
  }
}
```

---

## Production Checklist

- [ ] Environment variables validated on startup
- [ ] CORS configured with explicit origins
- [ ] Rate limiting enabled on all endpoints
- [ ] Helmet security headers configured
- [ ] Request validation pipe with whitelist
- [ ] Health check endpoint (`/health`)
- [ ] Graceful shutdown hooks enabled
- [ ] Error filter catches all exceptions
- [ ] Logging configured (structured, not console.log)
- [ ] Database connection pooling configured
- [ ] Redis connection for caching/sessions
- [ ] BullMQ workers for background jobs
- [ ] Sentry/error tracking integrated
- [ ] Metrics endpoint for Prometheus
- [ ] WebSocket authentication configured
- [ ] API versioning enabled
- [ ] Compression enabled
- [ ] Request timeout configured
- [ ] Circuit breaker for external services
- [ ] Audit logging for sensitive operations

---

## CI/CD Integration

### Docker Multi-Stage Build
```dockerfile
# Dockerfile
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
USER nestjs
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### GitHub Actions
```yaml
# .github/workflows/api.yml
name: API CI/CD
on:
  push:
    paths: ['apps/api/**', 'packages/prisma/**']

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @finpay/prisma db push
      - run: pnpm --filter @finpay/api test
      - run: pnpm --filter @finpay/api lint
```

---

## Team Conventions

### File Naming
- `kebab-case` for files: `users.controller.ts`, `auth.service.ts`
- `.module.ts` for modules, `.controller.ts` for controllers
- `.service.ts` for services, `.repository.ts` for repositories
- `.dto.ts` for DTOs, `.entity.ts` for entities
- `.spec.ts` for unit tests, `.e2e-spec.ts` for e2e tests

### Code Review Checklist
- [ ] No business logic in controllers
- [ ] Services use repository pattern
- [ ] DTOs validate all input
- [ ] Error handling is specific (not generic 500)
- [ ] Logging includes request context
- [ ] No hardcoded values (use ConfigService)
- [ ] Proper module boundaries (exports/imports)
- [ ] Tests cover happy path and error cases

### Onboarding
1. Read this skill file
2. Review `src/app.module.ts` and `src/main.ts`
3. Pick a feature module (e.g., `users/`) and trace the flow
4. Run `pnpm dev` and test with the API documentation
5. Write a small feature (e.g., a new CRUD endpoint)
