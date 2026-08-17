---
name: prisma
description: Enterprise Prisma 7+ ORM with schema design, migrations, client generation, transactions, connection pooling, performance optimization, and production patterns. Use when creating or modifying database schemas, writing Prisma queries, or managing migrations.
metadata:
  stack: prisma-7
  scope: database
  version: "7.9"
---

# Prisma 7 Enterprise ORM Guide

## Overview

Prisma is a next-generation ORM for Node.js and TypeScript. It provides type-safe database access, automated migrations, and a declarative schema language.

### When to Use Prisma
- TypeScript projects needing type-safe database access
- Teams wanting automated migrations
- Applications requiring complex queries with good DX
- Projects using PostgreSQL, MySQL, SQLite, or MongoDB

### Alternatives Considered
| ORM | Pros | Cons | When to Choose Prisma |
|-----|------|------|----------------------|
| TypeORM | Active Record pattern | Less type safety | Need Decorator-based models |
| Drizzle | SQL-like, lightweight | Smaller ecosystem | Need raw SQL feel |
| Kysely | Type-safe SQL builder | No migrations | Need SQL control |
| Sequelize | Mature, many dialects | Poor TS support | Legacy projects |

---

## Schema Design

### Complete Schema (FinPay)
```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client"
  output          = "../generated/prisma/client"
  previewFeatures = ["fullTextSearch", "metrics", "tracing", "multiSchema"]
  binaryTargets   = ["native", "rhel-openssl-1.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL") // For migrations (bypasses connection pool)
  schemas   = ["public", "auth"]
}

// ============================================
// Core Models
// ============================================

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  name              String?
  passwordHash      String?
  role              Role      @default(MEMBER)
  status            UserStatus @default(ACTIVE)
  emailVerified     Boolean   @default(false)
  emailVerifiedAt   DateTime?
  lastLoginAt       DateTime?
  failedLoginAttempts Int     @default(0)
  lockedUntil       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  deletedAt         DateTime?

  // Relations
  profile           Profile?
  sessions          Session[]
  posts             Post[]
  auditLogs         AuditLog[]
  organizations     OrganizationMember[]

  @@index([email])
  @@index([status])
  @@index([createdAt])
  @@map("users")
}

model Profile {
  id        String  @id @default(cuid())
  userId    String  @unique
  avatar    String?
  bio       String?
  phone     String?
  address   Json?
  metadata  Json?

  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("profiles")
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  token        String   @unique
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
  @@map("sessions")
}

// ============================================
// Multi-Tenant
// ============================================

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  plan      Plan     @default(FREE)
  metadata  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members   OrganizationMember[]
  projects  Project[]

  @@index([slug])
  @@map("organizations")
}

model OrganizationMember {
  id              String   @id @default(cuid())
  organizationId  String
  userId          String
  role            OrgRole  @default(MEMBER)
  invitedAt       DateTime @default(now())
  joinedAt        DateTime?

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@map("organization_members")
}

// ============================================
// Content
// ============================================

model Post {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  content     String?
  published   Boolean  @default(false)
  publishedAt DateTime?
  authorId    String
  orgId       String?
  tags        String[]
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  author      User          @relation(fields: [authorId], references: [id])
  organization Organization? @relation(fields: [orgId], references: [id])

  @@index([authorId])
  @@index([orgId])
  @@index([published, publishedAt])
  @@map("posts")
}

// ============================================
// Audit
// ============================================

model AuditLog {
  id              String   @id @default(cuid())
  userId          String?
  action          String
  entity          String
  entityId        String?
  oldValues       Json?
  newValues       Json?
  ipAddress       String?
  userAgent       String?
  createdAt       DateTime @default(now())

  user            User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([entity, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}

// ============================================
// Enums
// ============================================

enum Role {
  ADMIN
  MEMBER
  VIEWER
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  PENDING
}

enum OrgRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}
```

---

## PrismaService (Production)

```typescript
// prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma, LogLevel } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ] as { emit: 'event'; level: LogLevel }[],
      errorFormat: 'colorless',
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');

    if (process.env.NODE_ENV === 'development') {
      this.$on('query', (e: Prisma.QueryEvent) => {
        if (e.duration > 1000) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  // Transaction with retry logic
  async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number; retries?: number },
  ): Promise<T> {
    const { maxWait = 5000, timeout = 10000, retries = 3 } = options || {};

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.$transaction(fn, { maxWait, timeout });
      } catch (error) {
        this.logger.error(`Transaction attempt ${attempt} failed`, error);
        if (attempt === retries) throw error;
        await new Promise((r) => setTimeout(r, 100 * attempt));
      }
    }
    throw new Error('Transaction failed after retries');
  }

  // Soft delete helper
  async softDelete(model: string, id: string) {
    return this.$executeRawUnsafe(
      `UPDATE "${model}" SET "deletedAt" = NOW() WHERE "id" = $1`,
      id,
    );
  }

  // Paginated query helper
  async paginated<T>(
    model: string,
    params: {
      page?: number;
      limit?: number;
      where?: any;
      orderBy?: any;
      include?: any;
      select?: any;
    },
  ): Promise<{ data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    const { page = 1, limit = 20, where, orderBy, include, select } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      (this as any)[model].findMany({
        where: { ...where, deletedAt: null },
        skip,
        take: limit,
        orderBy,
        include,
        select,
      }),
      (this as any)[model].count({
        where: { ...where, deletedAt: null },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
```

---

## CRUD Patterns

### Basic CRUD
```typescript
// Create
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
    role: 'MEMBER',
  },
});

// Read with filtering
const users = await prisma.user.findMany({
  where: {
    status: 'ACTIVE',
    email: { contains: '@company.com', mode: 'insensitive' },
    role: { in: ['ADMIN', 'MEMBER'] },
    createdAt: { gte: new Date('2024-01-01') },
  },
  include: { profile: true },
  orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
  skip: 0,
  take: 20,
});

// Update
const updated = await prisma.user.update({
  where: { id: 'user-id' },
  data: { name: 'New Name', status: 'ACTIVE' },
});

// Upsert
const user = await prisma.user.upsert({
  where: { email: 'user@example.com' },
  create: { email: 'user@example.com', name: 'John' },
  update: { name: 'John Updated' },
});

// Delete (hard)
await prisma.user.delete({ where: { id: 'user-id' } });

// Delete (soft)
await prisma.user.update({
  where: { id: 'user-id' },
  data: { deletedAt: new Date() },
});
```

### Advanced Queries
```typescript
// Aggregation
const stats = await prisma.post.aggregate({
  where: { published: true },
  _count: true,
  _avg: { views: true },
  _sum: { views: true },
  _min: { createdAt: true },
  _max: { createdAt: true },
});

// Group By
const postsByAuthor = await prisma.post.groupBy({
  by: ['authorId'],
  where: { published: true },
  _count: true,
  orderBy: { _count: { authorId: 'desc' } },
});

// Find with cursor pagination
const cursor = await prisma.user.findMany({
  take: 20,
  skip: 1, // Skip the cursor
  cursor: { id: 'last-user-id' },
  orderBy: { id: 'asc' },
});

// Raw queries (when Prisma can't express the query)
const users = await prisma.$queryRaw`
  SELECT u.*, COUNT(p.id) as "postCount"
  FROM "User" u
  LEFT JOIN "Post" p ON p."authorId" = u.id
  WHERE u."deletedAt" IS NULL
  GROUP BY u.id
  ORDER BY "postCount" DESC
  LIMIT 10
`;

// Interactive transaction
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: { email: 'a@b.com' } });
  const post = await tx.post.create({ data: { title: 'Hi', authorId: user.id } });
  await tx.auditLog.create({
    data: { action: 'CREATE', entity: 'Post', entityId: post.id, userId: user.id },
  });
  return { user, post };
});
```

---

## Performance Optimization

### Indexing Strategy
```prisma
model User {
  // Single field index
  email String @unique
  status UserStatus

  // Composite index for common queries
  @@index([status, createdAt])
  @@index([email, status])

  // Partial index (PostgreSQL)
  @@index([email], where: """deletedAt IS NULL""")

  // Covering index for specific query
  @@index([status, createdAt, name])
}

model Post {
  // Full-text search index
  @@index([title, content], type: FullText)

  // GIN index for array fields
  @@index([tags], type: Gin)
}
```

### Query Optimization
```typescript
// ❌ BAD: N+1 query
const users = await prisma.user.findMany();
for (const user of users) {
  user.posts = await prisma.post.findMany({ where: { authorId: user.id } }); // N queries
}

// ✅ GOOD: Include
const users = await prisma.user.findMany({
  include: { posts: true }, // 1 query
});

// ✅ GOOD: Select only needed fields
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true }, // Less data transferred
});

// ✅ GOOD: Separate queries for complex cases
const [users, postCounts] = await Promise.all([
  prisma.user.findMany({ where: { status: 'ACTIVE' } }),
  prisma.post.groupBy({ by: ['authorId'], _count: true }),
]);
```

### Connection Pooling
```bash
# Environment variable
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"

# Prisma schema
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Migrations

```bash
# Create migration
npx prisma migrate dev --name add_user_role

# Deploy to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate client
npx prisma generate

# Pull schema from database
npx prisma db push

# Open Prisma Studio
npx prisma studio

# Validate schema
npx prisma validate

# Format schema
npx prisma format
```

### Migration Strategy
```bash
# 1. Create migration
npx prisma migrate dev --name add_payment_fields

# 2. Review generated SQL
cat prisma/migrations/xxxx_add_payment_fields/migration.sql

# 3. Test with seed
npx prisma db seed

# 4. Deploy to staging
npx prisma migrate deploy

# 5. Deploy to production
npx prisma migrate deploy
```

### Seed Script
```typescript
// prisma/seed.ts
import { PrismaClient } from '../generated/prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clean database
  await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE`;

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@finpay.com',
      name: 'Admin',
      passwordHash: await hash('admin123', 10),
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  console.log('Seed completed:', { admin });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Anti-Patterns

### ❌ Selecting All Fields
```typescript
// BAD
const users = await prisma.user.findMany();
// Returns ALL columns including passwordHash
```

### ✅ Explicit Selection
```typescript
// GOOD
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true, role: true },
});
```

### ❌ N+1 Queries
```typescript
// BAD
const posts = await prisma.post.findMany();
for (const post of posts) {
  post.author = await prisma.user.findUnique({ where: { id: post.authorId } });
}
```

### ✅ Include Relations
```typescript
// GOOD
const posts = await prisma.post.findMany({
  include: { author: { select: { id: true, name: true } } },
});
```

### ❌ Raw SQL Without Parameterization
```typescript
// BAD (SQL injection risk)
const users = await prisma.$queryRawUnsafe(
  `SELECT * FROM "User" WHERE name = '${name}'`
);
```

### ✅ Parameterized Queries
```typescript
// GOOD
const users = await prisma.$queryRaw`
  SELECT * FROM "User" WHERE name = ${name}
`;
```

---

## Anti-Patterns FinPay

### ❌ Float para Dinheiro
```typescript
// ❌ Precisão perdida - float
model Payment {
  amount    Float    @default(0)
  fee       Float    @default(0)
}
```

### ✅ Decimal para Dinheiro
```typescript
// ✅ Precisão exacta - Decimal
model Payment {
  amount    Decimal  @db.Decimal(19, 4)
  fee       Decimal  @db.Decimal(19, 4)
}
```

### ❌ Migrations sem Review
```bash
# ❌ Aplicar sem verificar
npx prisma migrate dev --name add-payment-field
npx prisma migrate deploy
```

### ✅ Migrations com Review
```bash
# ✅ Revisar antes de aplicar
npx prisma migrate dev --name add-payment-field
# Revisar ficheiro gerado em prisma/migrations/
# Testar localmente
# Depois aplicar em deploy
```

### ❌ Queries Cross-Tenant
```typescript
// ❌ Viola tenant isolation
const payments = await prisma.payment.findMany({
  where: { userId: someUserId } // Sem organizationId
});
```

### ✅ Queries com organizationId
```typescript
// ✅ Tenant isolation garantido
const payments = await prisma.payment.findMany({
  where: { organizationId, userId: someUserId }
});
```

### ❌ Seed Criando PrismaClient Próprio
```typescript
// ❌ Não usa o proxy @finpay/db
import { PrismaClient } from '../generated/prisma/client';
const prisma = new PrismaClient();
```

### ✅ Seed Usando Proxy
```typescript
// ✅ Usa o proxy compartilhado
import { prisma } from '@finpay/db';
```

### ❌ findMany() sem select/include
```typescript
// ❌ Expõe todos os campos
const users = await prisma.user.findMany();
```

### ✅ findMany() com select
```typescript
// ✅ Apenas campos necessários
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true }
});
```

---

## Troubleshooting

### Common Issues

**1. "Too many connections"**
```bash
# Increase connection limit
DATABASE_URL="...?connection_limit=20"
# Or use PgBouncer for connection pooling
```

**2. "Schema drift"**
```bash
# Reset and regenerate
npx prisma migrate reset
npx prisma generate
```

**3. Slow migrations**
```bash
# Use direct URL for migrations
DATABASE_URL="...?connection_limit=1"
npx prisma migrate deploy
```

**4. "Unique constraint violation" on upsert**
```bash
# Ensure unique constraint exists in schema
email String @unique
```

**5. Type errors after schema change**
```bash
npx prisma generate  # Must regenerate client after schema changes
```

---

## Production Checklist

- [ ] `directUrl` configured for migrations
- [ ] Connection pooling configured (`connection_limit`)
- [ ] Indexes on frequently queried fields
- [ ] Soft delete pattern implemented
- [ ] Audit logging for sensitive operations
- [ ] Seed script for initial data
- [ ] Migration rollback strategy
- [ ] Query logging in development
- [ ] Slow query alerts configured
- [ ] Backup strategy in place
- [ ] Read replicas for heavy read workloads
- [ ] `previewFeatures` reviewed before upgrade

---

## Team Conventions

### File Naming
- `prisma/schema.prisma` - Single source of truth
- `prisma/migrations/` - Migration history
- `prisma/seed.ts` - Database seeding
- `src/prisma/prisma.service.ts` - NestJS service wrapper
- `src/prisma/prisma.module.ts` - Module definition

### Schema Rules
- Always use `@default(cuid())` or `@default(uuid())` for IDs
- Always use `@map` for table names (PascalCase models, snake_case tables)
- Always use `@@index` on foreign keys
- Always use `deletedAt` for soft deletes
- Always use `createdAt` and `updatedAt` timestamps
- Never store passwords in plain text (use `passwordHash`)
- Never expose internal IDs in APIs (use slugs or public IDs)

### Code Review Checklist
- [ ] No `findMany()` without `select` or `include`
- [ ] No N+1 queries in loops
- [ ] Transactions for multi-step operations
- [ ] Proper error handling for unique constraints
- [ ] Soft delete instead of hard delete
- [ ] Indexes added for new query patterns
