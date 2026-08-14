---
name: vitest
description: Enterprise Vitest 4.x testing with configuration, mocking, coverage, snapshots, MSW integration, component testing, and CI patterns. Use when writing unit tests, integration tests, or configuring the test environment.
metadata:
  stack: vitest-4
  scope: testing
  version: "4.1"
---

# Vitest 4.x Enterprise Testing Guide

## Overview

Vitest is a fast, Vite-native testing framework with Jest-compatible API. It provides native ESM support, TypeScript out of the box, and powerful mocking capabilities.

### When to Use Vitest
- Vite-based projects (React, Vue, Svelte)
- TypeScript projects needing fast test execution
- Projects requiring Jest compatibility
- Teams wanting ESM-first testing
- Applications needing code coverage

---

## Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@finpay/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './src/test/msw-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'coverage'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      watermarks: {
        statements: [80, 95],
        branches: [80, 95],
        functions: [80, 95],
        lines: [80, 95],
      },
    },
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    sequence: {
      shuffle: true,
      concurrent: false,
    },
    reporters: ['verbose', 'html', 'json'],
    outputFile: {
      html: './coverage/test-report.html',
      json: './coverage/test-results.json',
    },
  },
});
```

## Setup Files

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// MSW Server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() { return null; }
  unobserve() { return null; }
  disconnect() { return null; }
};

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();
```

## MSW Setup

```typescript
// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse, delay } from 'msw';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const handlers = [
  // Users API
  http.get(`${API_BASE}/api/v1/users`, ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const limit = parseInt(url.searchParams.get('limit') ?? '10');

    return HttpResponse.json({
      data: [
        { id: '1', name: 'John Doe', email: 'john@example.com', role: 'ADMIN' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'MEMBER' },
      ],
      meta: { total: 2, page, limit, totalPages: 1 },
    });
  }),

  http.get(`${API_BASE}/api/v1/users/:id`, ({ params }) => {
    if (params.id === '999') {
      return HttpResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return HttpResponse.json({
      id: params.id,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'ADMIN',
    });
  }),

  http.post(`${API_BASE}/api/v1/users`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: '3', ...body, createdAt: new Date().toISOString() },
      { status: 201 }
    );
  }),

  // Delay simulation
  http.get(`${API_BASE}/api/v1/slow`, async () => {
    await delay(2000);
    return HttpResponse.json({ data: 'slow response' });
  }),

  // Error simulation
  http.get(`${API_BASE}/api/v1/error`, () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),
];
```

---

## Testing Patterns

### Component Testing
```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button } from './button';

// Helper function
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);

    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading state', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

### Async Testing
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { UserList } from './user-list';

it('loads and displays users', async () => {
  render(<UserList />);

  // Wait for loading to finish
  expect(await screen.findByText('John Doe')).toBeInTheDocument();
  expect(screen.getByText('Jane Smith')).toBeInTheDocument();
});

it('handles error state', async () => {
  render(<UserList userId="999" />);

  expect(await screen.findByText('User not found')).toBeInTheDocument();
});

it('handles loading state', () => {
  render(<UserList />);

  expect(screen.getByText('Loading...')).toBeInTheDocument();
});
```

### Form Testing
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './login-form';

it('validates form fields', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  // Submit empty form
  await user.click(screen.getByRole('button', { name: /submit/i }));

  // Check validation errors
  expect(await screen.findByText('Email is required')).toBeInTheDocument();
  expect(await screen.findByText('Password is required')).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('submits form with valid data', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });
});
```

### Mocking

```typescript
// Module mocking
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock implementation
vi.mocked(prisma.user.findMany).mockResolvedValue([
  { id: '1', name: 'John', email: 'john@example.com' },
]);

// Spy on methods
const spy = vi.spyOn(logger, 'error');

// Mock fetch globally
vi.stubGlobal('fetch', vi.fn());
vi.mocked(fetch).mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'test' }),
} as Response);

// Mock date
vi.setSystemTime(new Date('2024-01-15'));

// Mock crypto
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid',
});
```

### Snapshot Testing

```typescript
it('matches snapshot', () => {
  const { container } = render(<Component />);
  expect(container).toMatchSnapshot();
});

it('matches inline snapshot', () => {
  expect(formatDate(new Date('2024-01-15'))).toMatchInlineSnapshot('"January 15, 2024"');
});
```

---

## Commands

```bash
# Run all tests
npx vitest run

# Watch mode
npx vitest

# With coverage
npx vitest run --coverage

# Run specific file
npx vitest run src/components/button.test.tsx

# Run tests matching pattern
npx vitest run -t "renders correctly"

# UI mode
npx vitest --ui

# Project coverage
npx vitest run --coverage --reporter=json --reporter=html
```

---

## Anti-Patterns

### ❌ Testing Implementation Details
```typescript
// BAD: Tests internal state
it('increments count', () => {
  const { result } = renderHook(() => useCounter());
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);
});
```

### ✅ Testing User Behavior
```typescript
// GOOD: Tests what user sees
it('increments count when button clicked', async () => {
  const user = userEvent.setup();
  render(<Counter />);
  await user.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

---

## Production Checklist

- [ ] Test setup files configured
- [ ] MSW handlers for API mocking
- [ ] Coverage thresholds set (80%)
- [ ] Snapshot tests for critical components
- [ ] Async tests use `findBy*` or `waitFor`
- [ ] Mocks cleared between tests
- [ ] Tests run in CI pipeline
- [ ] HTML coverage report generated

---

## Team Conventions

### File Naming
- `*.test.ts` for unit tests
- `*.test.tsx` for component tests
- `*.spec.ts` for integration tests
- `*.e2e.ts` for end-to-end tests (use Playwright instead)

### Test Structure
```typescript
describe('ComponentName', () => {
  describe('when condition', () => {
    it('should expected behavior', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Query Priority
1. `getByRole` - Accessibility-first
2. `getByLabelText` - Form fields
3. `getByText` - Non-interactive elements
4. `getByTestId` - Last resort
