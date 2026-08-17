---
name: better-auth
description: Enterprise Better Auth 1.x with email/password, social providers, organizations, 2FA, session management, database adapters, and production security. Use when setting up authentication, authorization, or user management.
metadata:
  stack: better-auth-1
  scope: auth
  version: "1.6"
---

# Better Auth 1.x Enterprise Authentication Guide

## Overview

Better Auth is a framework-agnostic authentication and authorization library for TypeScript. It provides a comprehensive feature set including email/password, social login, organizations, 2FA, and more.

### When to Use Better Auth
- TypeScript projects needing comprehensive auth
- Multi-tenant applications with organizations
- Projects requiring 2FA/MFA
- Applications needing social login providers
- Teams wanting a self-hosted auth solution

### Alternatives Considered
| Solution | Pros | Cons | When to Choose Better Auth |
|----------|------|------|--------------------------|
| NextAuth.js | Next.js integration | Limited to Next.js | Need framework agnostic |
| Auth0 | Managed, easy setup | Expensive at scale | Need managed solution |
| Firebase Auth | Easy setup | Vendor lock-in | Google ecosystem |
| Lucia | Lightweight | DIY approach | Need full control |

---

## Server Configuration

```typescript
// packages/auth/src/index.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma';
import {
  organization,
  twoFactor,
  admin,
  bearer,
  apiKey,
} from 'better-auth/plugins';
import { prisma } from '@finpay/prisma';

export const auth = betterAuth({
  // ============================================
  // Database
  // ============================================
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  // ============================================
  // Base URL
  // ============================================
  baseURL: process.env.APP_URL || 'http://localhost:3000',

  // ============================================
  // Email & Password
  // ============================================
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    password: {
      // Custom password hashing (recommended)
      hash: async (password) => {
        const { hash } = await import('bcryptjs');
        return hash(password, 12);
      },
      verify: async ({ password, hash }) => {
        const { compare } = await import('bcryptjs');
        return compare(password, hash);
      },
    },
    // Rate limiting for auth
    maxAttemptsPerHour: 5,
  },

  // ============================================
  // Social Providers
  // ============================================
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scope: ['read:user', 'user:email'],
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ['openid', 'email', 'profile'],
    },
  },

  // ============================================
  // Account Linking
  // ============================================
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['email-password', 'github', 'google'],
    },
  },

  // ============================================
  // Session
  // ============================================
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    freshAge: 60 * 60, // 1 hour
    generateSessionId: () => crypto.randomUUID(),
  },

  // ============================================
  // Advanced Options
  // ============================================
  advanced: {
    generateId: () => crypto.randomUUID(),
    cookiePrefix: 'finpay',
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === 'production',
      domain: process.env.COOKIE_DOMAIN || '.finpay.com',
    },
  },

  // ============================================
  // Plugins
  // ============================================
  plugins: [
    // Multi-tenant organizations
    organization({
      roles: {
        owner: {
          permissions: ['*'],
        },
        admin: {
          permissions: ['read', 'write', 'delete', 'manage-members'],
        },
        member: {
          permissions: ['read', 'write'],
        },
        viewer: {
          permissions: ['read'],
        },
      },
      invitations: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        limit: 100, // Max pending invitations
      },
    }),

    // Two-Factor Authentication
    twoFactor({
      issuer: 'FinPay',
      totpOptions: {
        period: 30,
        digits: 6,
      },
    }),

    // Admin capabilities
    admin(),

    // Bearer token support
    bearer(),

    // API Key management
    apiKey({
      maxAge: 60 * 60 * 24 * 365, // 1 year
      prefix: 'fp_',
    }),
  ],
});

// Export types
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
```

---

## Client Configuration

```typescript
// packages/auth-client/src/index.ts
import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
});

// Destructure methods
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
} = authClient;
```

---

## Next.js Integration

```typescript
// packages/auth/src/next.ts
import { auth } from './index';
import { NextRequest, NextResponse } from 'next/server';

export async function getSession(req: NextRequest) {
  return auth.api.getSession({
    headers: req.headers,
  });
}

export async function requireAuth(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

// middleware.ts
import { getSession } from '@finpay/auth/next';

export async function middleware(req: NextRequest) {
  const session = await getSession(req);
  const { pathname } = req.nextUrl;

  // Protected routes
  if (pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Auth routes
  if ((pathname === '/login' || pathname === '/register') && session) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}
```

---

## NestJS Integration

```typescript
// src/modules/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { auth } from '@finpay/auth';
import { Request, Response } from 'express';

@Injectable()
export class AuthService {
  async getSession(req: Request) {
    return auth.api.getSession({
      headers: req.headers as Record<string, string>,
    });
  }

  async createSession(email: string, password: string) {
    return auth.api.signIn.email({
      email,
      password,
      callbackURL: '/dashboard',
    });
  }

  async createOAuthSession(provider: 'github' | 'google') {
    return auth.api.signIn.social({
      provider,
      callbackURL: '/dashboard',
    });
  }

  async signOut(req: Request, res: Response) {
    return auth.api.signOut({
      headers: req.headers as Record<string, string>,
    });
  }

  async createOrganization(name: string, userId: string) {
    return auth.api.organization.create({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      userId,
    });
  }

  async inviteToOrganization(orgId: string, email: string, role: string) {
    return auth.api.organization.invite({
      organizationId: orgId,
      email,
      role,
    });
  }

  async enableTwoFactor(userId: string) {
    return auth.api.twoFactor.enable({
      userId,
    });
  }
}
```

---

## Protected API Routes

```typescript
// app/api/v1/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@finpay/auth/next';
import { prisma } from '@finpay/prisma';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(users);
}

// app/api/v1/organizations/[orgId]/route.ts
import { getSession } from '@finpay/auth/next';

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check membership
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: params.orgId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Return organization data
}
```

---

## React Components

```tsx
// components/auth-provider.tsx
'use client';

import { SessionProvider } from 'better-auth/client/react';
import { authClient } from '@finpay/auth-client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      client={authClient}
      refetchInterval={60 * 5} // Refresh every 5 minutes
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  );
}

// components/user-menu.tsx
'use client';

import { useSession, authClient } from '@finpay/auth-client';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from 'radix-ui';

export function UserMenu() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button>{session.user.name}</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => authClient.signOut()}>
          Sign Out
        </DropdownMenuItem>
      </DropdownContent>
    </DropdownMenu>
  );
}
```

---

## Security Best Practices

### Password Hashing
```typescript
// Always use bcryptjs with salt rounds >= 12
import { hash, compare } from 'bcryptjs';

const passwordHash = await hash(password, 12);
const isValid = await compare(password, passwordHash);
```

### Rate Limiting
```typescript
// Apply to auth endpoints
ThrottlerModule.forRoot({
  throttlers: [
    { name: 'auth', ttl: 900000, limit: 5 }, // 5 attempts per 15 minutes
  ],
}),
```

### Session Security
```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7, // 7 days max
  updateAge: 60 * 60 * 24, // Refresh daily
  freshAge: 60 * 60, // Require fresh session for sensitive ops
}
```

### CSRF Protection
```typescript
// Better Auth handles CSRF automatically via cookies
// Ensure CORS is configured properly
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
});
```

---

## Anti-Patterns

### ❌ Storing Session in localStorage
```typescript
// BAD: Exposed to XSS
localStorage.setItem('token', session.token);
```

### ✅ Use HTTP-Only Cookies
```typescript
// GOOD: Better Auth uses HTTP-only cookies by default
// Session is stored in secure, HTTP-only cookie
```

### ❌ No Rate Limiting on Auth
```typescript
// BAD: Vulnerable to brute force
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

### ✅ Rate Limit Auth Endpoints
```typescript
// GOOD: Apply rate limiting
@Throttle({ auth: { limit: 5, ttl: 900000 } })
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

---

## Production Checklist

- [ ] Email verification enabled
- [ ] Password hashing with bcryptjs (rounds >= 12)
- [ ] Rate limiting on auth endpoints
- [ ] Session expiration configured
- [ ] CSRF protection enabled
- [ ] Secure cookies (HTTPS, HTTP-only, SameSite)
- [ ] Social providers configured
- [ ] Organization/teams setup
- [ ] 2FA available for users
- [ ] Audit logging for auth events
- [ ] Backup/recovery for auth database

---

## Team Conventions

### File Naming
- `packages/auth/src/index.ts` - Auth configuration
- `packages/auth-client/src/index.ts` - Client setup
- `src/modules/auth/` - NestJS auth module
- `middleware.ts` - Next.js auth middleware

### Security Rules
- Never store secrets in code
- Always use environment variables for API keys
- Never expose session tokens in URLs
- Always validate redirects
- Never trust user input for authorization decisions
