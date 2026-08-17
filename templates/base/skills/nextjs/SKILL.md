---
name: nextjs
description: Enterprise Next.js 16+ App Router with server components, layouts, API routes, middleware, caching, streaming, server actions, and full-stack patterns. Use when building or reviewing Next.js pages, layouts, routes, or configuration.
metadata:
  stack: next-16
  scope: frontend
  version: "16.3"
---

# Next.js 16 Enterprise App Router Guide

## Overview

Next.js is a React framework for building full-stack web applications with server-side rendering, static site generation, API routes, and edge runtime support.

### When to Use Next.js
- Full-stack applications with SEO requirements
- Apps needing SSR/SSG/ISR rendering strategies
- Projects requiring API routes alongside frontend
- Teams wanting file-based routing
- Applications needing edge runtime support

### Alternatives Considered
| Framework | Pros | Cons | When to Choose Next.js |
|-----------|------|------|----------------------|
| Remix | Simpler, web standards | Smaller ecosystem | Need simpler mental model |
| Nuxt | Vue ecosystem | Vue, not React | Vue projects |
| SvelteKit | Lightweight, fast | Smaller community | Need minimal JS |
| Astro | Content-first | Not for complex apps | Static/marketing sites |

---

## Project Structure

```
src/
├── app/                           # App Router
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Home page (/)
│   ├── loading.tsx                # Global loading UI
│   ├── error.tsx                  # Global error boundary
│   ├── not-found.tsx              # 404 page
│   ├── globals.css                # Global styles
│   ├── (auth)/                    # Route group (no URL segment)
│   │   ├── login/
│   │   │   └── page.tsx           # /login
│   │   ├── register/
│   │   │   └── page.tsx           # /register
│   │   └── layout.tsx             # Auth layout
│   ├── (dashboard)/               # Protected route group
│   │   ├── dashboard/
│   │   │   ├── layout.tsx         # Dashboard layout
│   │   │   ├── page.tsx           # /dashboard
│   │   │   └── settings/
│   │   │       └── page.tsx       # /dashboard/settings
│   │   └── layout.tsx             # Auth check layout
│   ├── api/                       # API Routes
│   │   └── v1/
│   │       ├── users/
│   │       │   └── route.ts       # /api/v1/users
│   │       └── health/
│   │           └── route.ts       # /api/v1/health
│   └── [...catchAll]/
│       └── page.tsx               # Catch-all route
├── components/
│   ├── ui/                        # Shared UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── card.tsx
│   └── features/                  # Feature components
│       ├── auth/
│       ├── dashboard/
│       └── payments/
├── lib/
│   ├── prisma.ts                  # Prisma client
│   ├── auth.ts                    # Auth configuration
│   ├── utils.ts                   # Utility functions
│   ├── validations.ts             # Zod schemas
│   └── api.ts                     # API client helpers
├── hooks/
│   ├── use-debounce.ts
│   └── use-media-query.ts
├── types/
│   └── index.ts
├── middleware.ts                   # Middleware
└── env.mjs                        # Environment validation
```

---

## Root Layout (Complete)

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'FinPay',
    template: '%s | FinPay',
  },
  description: 'Enterprise Payment Platform',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'FinPay',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
```

## Providers (Client Component)

```tsx
// components/providers.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { queryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

---

## Server Components (Data Fetching)

```tsx
// app/(dashboard)/dashboard/page.tsx
import { Suspense } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { StatsCards } from '@/components/features/dashboard/stats-cards';
import { RecentTransactions } from '@/components/features/dashboard/recent-transactions';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <Suspense fallback={<StatsCardsSkeleton />}>
        <StatsCards userId={session.user.id} />
      </Suspense>

      <Suspense fallback={<RecentTransactionsSkeleton />}>
        <RecentTransactions userId={session.user.id} />
      </Suspense>
    </div>
  );
}

// components/features/dashboard/stats-cards.tsx
import { prisma } from '@/lib/prisma';

export async function StatsCards({ userId }: { userId: string }) {
  const [totalTransactions, totalRevenue, activeUsers] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
  ]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatsCard title="Transactions" value={totalTransactions} />
      <StatsCard title="Revenue" value={`$${totalRevenue._sum.amount || 0}`} />
      <StatsCard title="Active Users" value={activeUsers} />
    </div>
  );
}
```

## Client Components (Interactive)

```tsx
// components/features/dashboard/recent-transactions.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

export function RecentTransactions({ userId }: { userId: string }) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['transactions', userId],
    queryFn: () => fetch(`/api/v1/users/${userId}/transactions?limit=5`).then((r) => r.json()),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
      <div className="space-y-4">
        {transactions?.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{tx.description}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(tx.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
            <span className={`font-mono ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {tx.amount > 0 ? '+' : ''}{tx.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## API Routes (Route Handlers)

```typescript
// app/api/v1/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { z } from 'zod';

const ListUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const result = ListUsersSchema.safeParse(searchParams);

  if (!result.success) {
    return NextResponse.json({ error: 'Invalid params', details: result.error.issues }, { status: 400 });
  }

  const { page, limit, search, role } = result.data;
  const skip = (page - 1) * limit;

  const where = {
    deletedAt: null,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(role && { role }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    data: users,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// app/api/v1/users/route.ts - POST
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const CreateUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2).max(100),
    role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
  });

  const result = CreateUserSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid body', details: result.error.issues }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: result.data.email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  }

  const user = await prisma.user.create({ data: result.data });
  return NextResponse.json(user, { status: 201 });
}
```

---

## Middleware (Auth + Security)

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/settings', '/api'];
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('session')?.value;

  // Protected routes - redirect to login if no token
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Auth routes - redirect to dashboard if has token
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
```

---

## Server Actions

```typescript
// app/actions/user.ts
'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
});

export async function updateUser(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error('Unauthorized');

  const rawData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
  };

  const result = UpdateUserSchema.safeParse(rawData);
  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: result.data,
  });

  revalidatePath('/dashboard/settings');
  return { success: true };
}
```

---

## Caching Strategies

```typescript
// app/dashboard/page.tsx - ISR (Incremental Static Regeneration)
export const revalidate = 3600; // Revalidate every hour

// Force dynamic (no cache)
export const dynamic = 'force-dynamic';

// app/api/data/route.ts - Route Handler caching
export async function GET() {
  const data = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });
  return Response.json(await data.json());
}

// Client-side with React Query
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
});
```

---

## Performance Optimization

### Image Optimization
```tsx
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // Above the fold
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

### Font Optimization
```tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Show text immediately
  variable: '--font-sans',
});
```

### Dynamic Imports
```tsx
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('@/components/heavy-chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Only load on client
});
```

---

## Anti-Patterns

### ❌ Client Component for Everything
```tsx
'use client'; // ❌ Unnecessary
export function Page() {
  return <div>Hello</div>;
}
```

### ✅ Server Component by Default
```tsx
// ✅ No "use client" needed
export default function Page() {
  return <div>Hello</div>;
}
```

### ❌ useEffect for Data Fetching
```tsx
'use client';
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);
```

### ✅ Server Components or React Query
```tsx
// ✅ Server Component
async function Page() {
  const data = await fetchData();
  return <div>{data.name}</div>;
}
```

---

## Anti-Patterns FinPay

### ❌ "use client" no Root Layout
```tsx
// ❌ Root layout NUNCA deve ter "use client"
'use client';
export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>;
}
```

### ✅ Root Layout como Server Component
```tsx
// ✅ Root layout SEMPRE Server Component
export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>;
}
```

### ❌ Providers no Root Layout
```tsx
// ❌ Providers devem estar no layout mais profundo possível
'use client';
export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

### ✅ Providers em Layout de Rota
```tsx
// ✅ Providers no layout da rota específica
'use client';
export default function DashboardLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### ❌ Fetch no Client sem AbortController
```tsx
// ❌ Memory leak - sem cleanup
'use client';
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);
```

### ✅ Fetch com AbortController
```tsx
// ✅ Cleanup adequado
'use client';
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json())
    .then(setData);
  return () => controller.abort();
}, []);
```

### ❌ Imports Direto de shadcn
```tsx
// ❌ NUNCA importar directo do node_modules
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
```

### ✅ Imports via @finpay/ui
```tsx
// ✅ SEMPRE importar do package compartilhado
import { Button, Card } from '@finpay/ui';
```

### ❌ <img> em vez de next/image
```tsx
// ❌ Sem optimização
<img src="/logo.png" alt="Logo" />

// ✅ Com optimização
import Image from 'next/image';
<Image src="/logo.png" alt="Logo" width={200} height={50} />
```

### ❌ Font sem next/font
```tsx
// ❌ Carregamento manual
<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />

// ✅ Optimização automática
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
```

### ❌ Meta Tags Hardcoded
```tsx
// ❌ Metadata estática
<head>
  <title>FinPay</title>
  <meta name="description" content="Pagamentos" />
</head>

// ✅ Metadata dinâmica
export const metadata: Metadata = {
  title: `${productName} - ${pageTitle}`,
  description: pageDescription,
};
```

---

## Production Checklist

- [ ] `next.config.ts` with security headers
- [ ] Middleware for auth on protected routes
- [ ] API routes with input validation (Zod)
- [ ] Error boundaries (`error.tsx`)
- [ ] Loading states (`loading.tsx`)
- [ ] Metadata for SEO
- [ ] Image optimization
- [ ] Font optimization
- [ ] Caching strategy (ISR/SSR)
- [ ] Environment variables validated
- [ ] TypeScript strict mode
- [ ] ESLint + Prettier configured
- [ ] Lighthouse score > 90

---

## Team Conventions

### File Naming
- `kebab-case` for files: `user-profile.tsx`
- `page.tsx` for route pages
- `layout.tsx` for route layouts
- `loading.tsx` for loading UI
- `error.tsx` for error boundaries
- `not-found.tsx` for 404 pages
- `route.ts` for API routes
- `actions/*.ts` for server actions

### Component Rules
- Server Components by default
- Add `"use client"` only when needed (hooks, browser APIs)
- Keep client components small and focused
- Pass server data as props to client components
- Never fetch data in client components when possible
