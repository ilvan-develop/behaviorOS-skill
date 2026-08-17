---
name: zod
description: Enterprise Zod 4.x schema validation with types, transforms, coercion, pipe, error customization, and integration patterns. Use when defining validation schemas, parsing data, or creating type-safe APIs.
metadata:
  stack: zod-4
  scope: validation
  version: "4.4"
---

# Zod 4 Enterprise Schema Validation Guide

## Overview

Zod is a TypeScript-first schema declaration and validation library. It provides static type inference, runtime validation, and excellent error messages.

### When to Use Zod
- API input/output validation
- Form validation (with React Hook Form)
- Environment variable validation
- Configuration file validation
- Type-safe data transformation

---

## Basic Schemas

```typescript
import { z } from 'zod';

// ============================================
// Primitives
// ============================================

const nameSchema = z.string().min(2).max(100);
const ageSchema = z.number().int().min(0).max(150);
const emailSchema = z.string().email();
const urlSchema = z.string().url();
const uuidSchema = z.string().uuid();
const dateSchema = z.coerce.date();
const booleanSchema = z.boolean();

// ============================================
// Objects
// ============================================

const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'member', 'viewer']),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  age: z.number().int().min(18).optional(),
  metadata: z.record(z.string()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ============================================
// Arrays
// ============================================

const tagsSchema = z.array(z.string()).min(1).max(10);
const usersSchema = z.array(userSchema);

// ============================================
// Nested Objects
// ============================================

const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(2),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().length(2),
});

const profileSchema = z.object({
  user: userSchema,
  address: addressSchema,
  tags: tagsSchema,
});
```

---

## Type Inference

```typescript
type User = z.infer<typeof userSchema>;
// {
//   id: string;
//   email: string;
//   name: string;
//   role: 'admin' | 'member' | 'viewer';
//   status: 'active' | 'inactive' | 'suspended';
//   age?: number;
//   metadata?: Record<string, string>;
//   createdAt: Date;
//   updatedAt: Date;
// }

type CreateUserInput = z.input<typeof userSchema>;  // Input type (before transforms)
type UserOutput = z.output<typeof userSchema>;       // Output type (after transforms)
```

---

## Parsing

```typescript
// Throws on error
const user = userSchema.parse(data);

// Returns result object (safe)
const result = userSchema.safeParse(data);
if (result.success) {
  console.log(result.data); // Typed data
} else {
  console.error(result.error.issues);
  // [
  //   { code: 'invalid_type', path: ['email'], message: 'Expected string, received number' },
  //   { code: 'too_small', path: ['name'], message: 'String must contain at least 2 character(s)' }
  // ]
}

// Async parsing
const asyncResult = await userSchema.safeParseAsync(data);
```

---

## Custom Error Messages

```typescript
const schema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(8, { message: 'Password must be at least 8 characters' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' }),
  name: z.string().min(2, { message: 'Name is required' }).max(100),
  age: z.number().min(18, { message: 'Must be at least 18 years old' }),
});
```

---

## Refine (Custom Validation)

```typescript
// Single field refinement
const passwordSchema = z.string().min(8).refine(
  (val) => /[A-Z]/.test(val) && /[0-9]/.test(val),
  { message: 'Password must contain uppercase and number' }
);

// Cross-field validation
const formSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  });
```

---

## Transforms

```typescript
// Transform data
const schema = z.string().transform((val) => val.trim());
const numberSchema = z.string().transform(Number);
const dateSchema = z.string().transform((val) => new Date(val));

// Complex transform
const userCreateSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(2),
    password: z.string().min(8),
  })
  .transform((data) => ({
    ...data,
    email: data.email.toLowerCase(),
    name: data.name.trim(),
  }));
```

---

## Zod + React Hook Form

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

type FormData = z.infer<typeof schema>;

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
    </form>
  );
}
```

---

## Zod + oRPC

```typescript
import { oc } from '@orpc/contract';

const contract = {
  createUser: oc
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(2),
        password: z.string().min(8),
      })
    )
    .output(userSchema),
};
```

---

## Environment Variables

```typescript
// env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
```

---

## Anti-Patterns

### ❌ Manual Validation
```typescript
// BAD
if (!data.email || !data.email.includes('@')) {
  throw new Error('Invalid email');
}
```

### ✅ Use Zod
```typescript
// GOOD
const result = emailSchema.safeParse(data);
if (!result.success) {
  throw new Error(result.error.issues[0].message);
}
```

### ❌ Duplicate Type Definitions
```typescript
// BAD: Types defined separately
interface User {
  id: string;
  email: string;
  name: string;
}
const userSchema = z.object({ id: z.string(), email: z.string(), name: z.string() });
```

### ✅ Infer from Schema
```typescript
// GOOD: Single source of truth
const userSchema = z.object({ id: z.string(), email: z.string(), name: z.string() });
type User = z.infer<typeof userSchema>;
```

---

## Production Checklist

- [ ] Schemas defined for all API inputs/outputs
- [ ] Error messages are user-friendly
- [ ] Environment variables validated on startup
- [ ] Forms use zodResolver
- [ ] Types inferred from schemas (not duplicated)
- [ ] Cross-field validation using refine
- [ ] Transforms for data normalization

---

## Team Conventions

### Schema Naming
```typescript
// Schema names
userSchema          // Single object
createUserSchema    // Create input
updateUserSchema    // Update input
listUsersSchema     // List query params
userResponseSchema  // API response
```

### File Structure
```typescript
// schemas/user.ts
export const userSchema = z.object({...});
export const createUserSchema = z.object({...});
export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
```
