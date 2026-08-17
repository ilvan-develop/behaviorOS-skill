---
name: react
description: Enterprise React 19+ patterns with server components, hooks, suspense, transitions, server actions, and modern React best practices. Use when building React components, managing state, or implementing React features.
metadata:
  stack: react-19
  scope: frontend
  version: "19.2"
---

# React 19 Enterprise Patterns Guide

## Overview

React is a JavaScript library for building user interfaces. React 19 introduces Server Components, Server Actions, and improved hooks.

### When to Use React
- Interactive user interfaces
- Single-page applications
- Components with complex state
- Projects needing rich interactivity
- Teams familiar with component-based architecture

---

## Server Components (Next.js)

```tsx
// Default: Server Component (no "use client")
import { prisma } from '@/lib/prisma';

async function UserList() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
export default UserList;
```

---

## Client Components

```tsx
'use client';

import { useState, useTransition, useOptimistic } from 'react';

function InteractiveComponent() {
  const [count, setCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const increment = () => {
    startTransition(async () => {
      await updateCount(count + 1);
      setCount(count + 1);
    });
  };

  return (
    <button onClick={increment} disabled={isPending}>
      {isPending ? 'Updating...' : `Count: ${count}`}
    </button>
  );
}
```

---

## useOptimistic

```tsx
function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, { ...newTodo, pending: true }]
  );

  const handleSubmit = async (formData: FormData) => {
    const text = formData.get('text') as string;
    const todo = { id: crypto.randomUUID(), text };
    addOptimisticTodo(todo);
    await createTodo(todo);
  };

  return (
    <div>
      <form action={handleSubmit}>
        <input name="text" />
        <button type="submit">Add</button>
      </form>
      {optimisticTodos.map((todo) => (
        <div key={todo.id} className={todo.pending ? 'opacity-50' : ''}>
          {todo.text}
        </div>
      ))}
    </div>
  );
}
```

---

## useActionState (React 19)

```tsx
import { useActionState } from 'react';

function Form() {
  const [state, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      const result = await submitForm(formData);
      if (result.error) return { error: result.error };
      return { success: true };
    },
    { error: null }
  );

  return (
    <form action={formAction}>
      <input name="email" />
      {state.error && <span>{state.error}</span>}
      <button disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

---

## Ref as Prop (React 19)

```tsx
// No need for forwardRef in React 19
function Input({
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
}) {
  return <input ref={ref} {...props} />;
}
```

---

## Custom Hooks

```typescript
// use-debounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// use-media-query.ts
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
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
// ✅ No "use client"
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

### ❌ Componentes sem Suspense
```tsx
// ❌ Sem loading state
export default function Dashboard() {
  const data = fetchData();
  return <div>{data.name}</div>;
}
```

### ✅ Componentes com Suspense
```tsx
// ✅ Com loading state
import { Suspense } from 'react';
export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
```

### ❌ useEffect para Subscriptions
```tsx
// ❌ Memory leak - sem cleanup
useEffect(() => {
  socket.on('message', handleMessage);
}, []);
```

### ✅ Subscriptions com Cleanup
```tsx
// ✅ Cleanup adequado
useEffect(() => {
  socket.on('message', handleMessage);
  return () => socket.off('message', handleMessage);
}, []);
```

### ❌ State Gerenciado sem Invalidação
```tsx
// ❌ Dados stale - sem revalidação
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);
```

### ✅ State com React Query
```tsx
// ✅ Revalidação automática
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 5 * 60 * 1000, // 5 minutos
});
```

### ❌ Hooks Customizados sem Cleanup
```tsx
// ❌ Memory leak
function useInterval(callback, delay) {
  useEffect(() => {
    setInterval(callback, delay);
  }, [callback, delay]);
}
```

### ✅ Hooks com Cleanup
```tsx
// ✅ Cleanup adequado
function useInterval(callback, delay) {
  useEffect(() => {
    const id = setInterval(callback, delay);
    return () => clearInterval(id);
  }, [callback, delay]);
}
```

### ❌ Server Components sem Streaming
```tsx
// ❌ Sem streaming - carrega tudo de uma vez
async function Page() {
  const data = await fetchLargeData();
  return <div>{data}</div>;
}
```

### ✅ Server Components com Streaming
```tsx
// ✅ Streaming - carrega progressivamente
async function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <SlowComponent />
    </Suspense>
  );
}
```

---

## Production Checklist

- [ ] Server Components by default
- [ ] "use client" only when needed
- [ ] Suspense boundaries for loading states
- [ ] Error boundaries for error handling
- [ ] Optimistic updates for better UX
- [ ] useTransition for non-blocking updates
- [ ] Custom hooks for reusable logic
- [ ] Proper TypeScript types

---

## Team Conventions

### File Structure
```typescript
// components/ui/        - Shared UI components
// components/features/  - Feature-specific components
// hooks/                - Custom hooks
// lib/                  - Utilities
// types/                - TypeScript types
```

### Component Rules
- Server Components by default
- Add "use client" only when needed
- Keep client components small
- Pass server data as props
- Never fetch data in client components when possible
