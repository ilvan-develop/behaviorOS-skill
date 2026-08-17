---
name: orpc
description: Enterprise oRPC 1.x type-safe API with contracts, server implementation, OpenAPI generation, TanStack Query integration, and end-to-end type safety. Use when building type-safe APIs, defining contracts, or setting up oRPC routers.
metadata:
  stack: orpc-1
  scope: api
  version: "1.14"
---

# oRPC 1.x Enterprise Type-Safe API Guide

## Overview

oRPC is a type-safe RPC framework that combines end-to-end type safety with OpenAPI compliance. It allows you to define contracts once and use them across server and client with full type inference.

### When to Use oRPC
- TypeScript projects needing end-to-end type safety
- APIs requiring OpenAPI documentation
- Projects using TanStack Query for data fetching
- Teams wanting contract-first development
- Microservices needing type-safe communication

### Alternatives Considered
| Framework | Pros | Cons | When to Choose oRPC |
|-----------|------|------|-------------------|
| tRPC | Simple, popular | No OpenAPI, TypeScript only | Need OpenAPI docs |
| gRPC | Fast, binary | Complex setup | Need high performance |
| GraphQL | Flexible | Complex schema | Need flexible queries |
| REST | Simple | No type safety | Need maximum compatibility |

---

## Architecture

```
packages/
├── contract/              # Shared contracts
│   ├── src/
│   │   ├── index.ts       # Contract exports
│   │   ├── user.ts        # User contract
│   │   ├── payment.ts     # Payment contract
│   │   └── schemas.ts     # Zod schemas
│   └── package.json
├── server/                # Server implementation
│   ├── src/
│   │   ├── index.ts       # Router setup
│   │   ├── routers/
│   │   │   ├── user.ts    # User router
│   │   │   └── payment.ts # Payment router
│   │   └── context.ts     # Request context
│   └── package.json
└── client/                # Client (Next.js, etc.)
    ├── src/
    │   ├── lib/
    │   │   ├── orpc.ts    # oRPC client
    │   │   └── query.ts   # Query utils
    │   └── hooks/
    │       └── use-users.ts
    └── package.json
```

---

## Contract Definition

```typescript
// packages/contract/src/schemas.ts
import { z } from 'zod';

// ============================================
// Shared Schemas
// ============================================

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const IdSchema = z.string().uuid();

export const DateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ============================================
// User Schemas
// ============================================

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'member', 'viewer']),
  status: z.enum(['active', 'inactive', 'suspended']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'member']).default('member'),
  password: z.string().min(8).max(128),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'member', 'viewer']).optional(),
});

export const ListUsersSchema = PaginationSchema.extend({
  role: z.enum(['admin', 'member', 'viewer']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

// ============================================
// Payment Schemas
// ============================================

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'refunded']),
  userId: z.string().uuid(),
  createdAt: z.coerce.date(),
});

export const CreatePaymentSchema = z.object({
  amount: z.number().positive().max(1000000),
  currency: z.string().length(3).default('USD'),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string()).optional(),
});

// ============================================
// Types
// ============================================

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type ListUsers = z.input<typeof ListUsersSchema>;

export type Payment = z.infer<typeof PaymentSchema>;
export type CreatePayment = z.infer<typeof CreatePaymentSchema>;
```

```typescript
// packages/contract/src/user.ts
import { oc } from '@orpc/contract';
import {
  UserSchema,
  CreateUserSchema,
  UpdateUserSchema,
  ListUsersSchema,
  IdSchema,
} from './schemas';

export const userContract = {
  list: oc
    .input(ListUsersSchema)
    .output(z.object({
      data: z.array(UserSchema),
      meta: z.object({
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        totalPages: z.number(),
      }),
    })),

  getById: oc
    .input(z.object({ id: IdSchema }))
    .output(UserSchema),

  create: oc
    .input(CreateUserSchema)
    .output(UserSchema),

  update: oc
    .input(z.object({ id: IdSchema }).merge(UpdateUserSchema))
    .output(UserSchema),

  delete: oc
    .input(z.object({ id: IdSchema }))
    .output(z.object({ success: z.boolean() })),
};
```

```typescript
// packages/contract/src/payment.ts
import { oc } from '@orpc/contract';
import { PaymentSchema, CreatePaymentSchema, IdSchema, PaginationSchema } from './schemas';

export const paymentContract = {
  list: oc
    .input(PaginationSchema.extend({ userId: IdSchema.optional() }))
    .output(z.object({
      data: z.array(PaymentSchema),
      meta: z.object({ total: z.number(), page: z.number(), limit: z.number() }),
    })),

  getById: oc
    .input(z.object({ id: IdSchema }))
    .output(PaymentSchema),

  create: oc
    .input(CreatePaymentSchema)
    .output(PaymentSchema),

  refund: oc
    .input(z.object({ id: IdSchema, reason: z.string().max(500) }))
    .output(PaymentSchema),
};
```

```typescript
// packages/contract/src/index.ts
export { userContract } from './user';
export { paymentContract } from './payment';
export * from './schemas';
```

---

## Server Implementation

```typescript
// packages/server/src/routers/user.ts
import { userContract } from '@finpay/contract';
import { prisma } from '../prisma';
import { TRPCError } from '@trpc/server'; // Or custom errors
import { hash } from 'bcryptjs';

export const userRouter = {
  list: async ({ input }) => {
    const { page, limit, search, role, status } = input;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(role && { role }),
      ...(status && { status }),
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  },

  getById: async ({ input }) => {
    const user = await prisma.user.findUnique({
      where: { id: input.id, deletedAt: null },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true },
    });

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    return user;
  },

  create: async ({ input }) => {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Email already exists' });
    }

    const passwordHash = await hash(input.password, 12);
    const { password, ...data } = input;

    return prisma.user.create({
      data: { ...data, passwordHash, status: 'ACTIVE' },
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true },
    });
  },

  update: async ({ input }) => {
    const { id, ...data } = input;

    const user = await prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, updatedAt: true },
    });
  },

  delete: async ({ input }) => {
    const user = await prisma.user.findUnique({ where: { id: input.id, deletedAt: null } });
    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    await prisma.user.update({
      where: { id: input.id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  },
};
```

---

## OpenAPI Generation

```typescript
// packages/server/src/openapi.ts
import { generateOpenAPI } from '@orpc/openapi';
import { userContract } from '@finpay/contract';
import { paymentContract } from '@finpay/contract';

const openAPI = generateOpenAPI({
  info: {
    title: 'FinPay API',
    version: '1.0.0',
    description: 'Enterprise Payment Platform API',
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Development' },
    { url: 'https://api.finpay.com', description: 'Production' },
  ],
  paths: {
    '/users': {
      get: { ...userContract.list },
      post: { ...userContract.create },
    },
    '/users/{id}': {
      get: { ...userContract.getById },
      put: { ...userContract.update },
      delete: { ...userContract.delete },
    },
  },
});

export default openAPI;
```

---

## TanStack Query Integration

```typescript
// packages/client/src/lib/orpc.ts
import { createORPCClient } from '@orpc/client';
import { createORPCFetchHandler } from '@orpc/fetch';
import { createORPCQueryUtils } from '@orpc/react-query';
import type { AppRouter } from '@finpay/server';

const client = createORPCClient<AppRouter>({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});

export const orpc = createORPCQueryUtils(client);
```

```typescript
// packages/client/src/hooks/use-users.ts
import { orpc } from '@/lib/orpc';

// Query
export function useUsers(params: ListUsersParams) {
  return orpc.user.list.useQuery(params, {
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

// Mutation
export function useCreateUser() {
  const queryClient = useQueryClient();

  return orpc.user.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'list'] });
    },
  });
}
```

```tsx
// packages/client/src/components/users-list.tsx
'use client';

import { useUsers } from '@/hooks/use-users';

export function UsersList() {
  const { data, isLoading, error } = useUsers({ page: 1, limit: 10 });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.data.map((user) => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}
```

---

## Production Checklist

- [ ] Contracts defined with Zod schemas
- [ ] Server implementation matches contract
- [ ] OpenAPI spec generated and served
- [ ] Error handling with proper codes
- [ ] Input validation on all endpoints
- [ ] Authentication middleware
- [ ] Rate limiting configured
- [ ] Logging for all operations
- [ ] Metrics collection

---

## Team Conventions

### Contract-First Development
1. Define schema in `contract/src/schemas.ts`
2. Add endpoint to contract (e.g., `userContract`)
3. Implement in server router
4. Generate OpenAPI spec
5. Use client with TanStack Query

### File Naming
- `contract/src/*.ts` - Contract definitions
- `server/src/routers/*.ts` - Server implementations
- `client/src/hooks/*.ts` - React hooks
- `client/src/lib/orpc.ts` - Client setup
