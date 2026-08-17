---
name: msw
description: Enterprise MSW 2.x API mocking with handlers, rest/http, graphql, setup server, and browser integration. Use when mocking API responses, setting up test fixtures, or intercepting network requests.
metadata:
  stack: msw-2
  scope: testing
  version: "2.4"
---

# MSW 2.x Enterprise API Mocking Guide

## Overview

MSW (Mock Service Worker) intercepts network requests at the network level, allowing you to mock API responses in both tests and development.

### When to Use MSW
- Unit/integration testing with mock APIs
- Development without backend
- Storybook with realistic data
- E2E testing with mock responses
- Prototyping frontend independently

---

## Setup (Node/Vitest)

```typescript
// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// src/test/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Handler Patterns

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const handlers = [
  // ============================================
  // GET with query params
  // ============================================
  http.get(`${API_BASE}/api/v1/users`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '10');
    const search = url.searchParams.get('search');

    let users = [
      { id: '1', name: 'John Doe', email: 'john@example.com', role: 'ADMIN' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'MEMBER' },
      { id: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'MEMBER' },
    ];

    if (search) {
      users = users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    const start = (page - 1) * limit;
    const paginatedUsers = users.slice(start, start + limit);

    return HttpResponse.json({
      data: paginatedUsers,
      meta: { total: users.length, page, limit, totalPages: Math.ceil(users.length / limit) },
    });
  }),

  // ============================================
  // GET with path params
  // ============================================
  http.get(`${API_BASE}/api/v1/users/:id`, ({ params }) => {
    if (params.id === '999') {
      return HttpResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return HttpResponse.json({
      id: params.id,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'ADMIN',
      createdAt: '2024-01-15T10:30:00Z',
    });
  }),

  // ============================================
  // POST with body
  // ============================================
  http.post(`${API_BASE}/api/v1/users`, async ({ request }) => {
    const body = await request.json() as any;

    if (!body.email) {
      return HttpResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    return HttpResponse.json(
      {
        id: '3',
        ...body,
        createdAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // ============================================
  // Delay simulation
  // ============================================
  http.get(`${API_BASE}/api/v1/slow`, async () => {
    await delay(2000);
    return HttpResponse.json({ data: 'slow response' });
  }),

  // ============================================
  // Error simulation
  // ============================================
  http.get(`${API_BASE}/api/v1/error`, () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),

  // ============================================
  // Network error
  // ============================================
  http.get(`${API_BASE}/api/v1/network-error`, () => {
    return HttpResponse.error();
  }),
];
```

---

## Override in Tests

```typescript
it('handles error case', async () => {
  // Override handler for this test only
  server.use(
    http.get('/api/v1/users', () => {
      return HttpResponse.json({ error: 'Server error' }, { status: 500 });
    })
  );

  render(<UsersList />);
  expect(await screen.findByText('Error loading users')).toBeInTheDocument();
});
```

---

## Browser Setup (Development)

```typescript
// src/test/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

```typescript
// src/main.tsx
async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') return;
  const { worker } = await import('./mocks/browser');
  return worker.start({ onUnhandledRequest: 'warning' });
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
});
```

---

## Anti-Patterns

### ❌ Mocking in Component
```tsx
// BAD: Component knows about mocking
useEffect(() => {
  if (process.env.NODE_ENV === 'test') {
    // Mock behavior
  }
}, []);
```

### ✅ Mock at Network Level
```typescript
// GOOD: MSW intercepts at network level
http.get('/api/users', () => {
  return HttpResponse.json(mockUsers);
});
```

---

## Production Checklist

- [ ] Handlers defined for all API endpoints
- [ ] Error scenarios mocked
- [ ] Loading states tested
- [ ] Unhandled requests flagged
- [ ] Mock data matches real API shape
- [ ] Reset handlers between tests

---

## Team Conventions

### Handler Organization
```typescript
// handlers/users.ts
export const userHandlers = [...];

// handlers/payments.ts
export const paymentHandlers = [...];

// handlers/index.ts
export const handlers = [...userHandlers, ...paymentHandlers];
```
