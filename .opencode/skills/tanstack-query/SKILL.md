---
name: tanstack-query
description: Enterprise TanStack Query (React Query) v5 with queries, mutations, caching, optimistic updates, infinite queries, and QueryClient configuration. Use when implementing data fetching, server state management, or caching in React.
metadata:
  stack: tanstack-query-5
  scope: data
  version: "5.101"
---

# TanStack Query v5 Enterprise Guide

## Overview

TanStack Query is a powerful asynchronous state management library for TS/JS and React. It provides utilities for data fetching, caching, synchronization, and updating server state.

### When to Use TanStack Query
- Server state management (data from APIs)
- Caching API responses
- Optimistic updates
- Infinite scrolling
- Background refetching
- Dependent queries

---

## QueryClient Setup

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
    },
  },
});
```

```tsx
// providers.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## Custom Hooks

```typescript
// hooks/use-users.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Fetch users
export function useUsers(params: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.search) searchParams.set('search', params.search);

      const response = await fetch(`/api/v1/users?${searchParams}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    placeholderData: (prev) => prev, // Keep previous data while fetching new
  });
}

// Fetch single user
export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => {
      const response = await fetch(`/api/v1/users/${id}`);
      if (!response.ok) throw new Error('Failed to fetch user');
      return response.json();
    },
    enabled: !!id, // Only run if id exists
  });
}

// Create user
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const response = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create user');
      return response.json();
    },
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

// Update user with optimistic update
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateUserInput) => {
      const response = await fetch(`/api/v1/users/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update user');
      return response.json();
    },
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['users'] });

      // Snapshot previous value
      const previousUsers = queryClient.getQueryData(['users']);

      // Optimistically update
      queryClient.setQueryData(['users'], (old: any) =>
        old?.map((user: any) => (user.id === newData.id ? { ...user, ...newData } : user))
      );

      return { previousUsers };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(['users'], context?.previousUsers);
      toast.error('Failed to update user');
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Delete user
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/users/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete user');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
    },
  });
}
```

---

## Infinite Query

```typescript
// hooks/use-infinite-users.ts
import { useInfiniteQuery } from '@tanstack/react-query';

export function useInfiniteUsers(search?: string) {
  return useInfiniteQuery({
    queryKey: ['users', 'infinite', search],
    queryFn: async ({ pageParam = 1 }) => {
      const searchParams = new URLSearchParams({
        page: pageParam.toString(),
        limit: '20',
      });
      if (search) searchParams.set('search', search);

      const response = await fetch(`/api/v1/users?${searchParams}`);
      return response.json();
    },
    getNextPageParam: (lastPage, allPages) => {
      return allPages.length < Math.ceil(lastPage.meta.total / 20)
        ? allPages.length + 1
        : undefined;
    },
    initialPageParam: 1,
  });
}

// In component
function UserList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteUsers();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {data?.pages.map((page) =>
        page.data.map((user) => (
          <div key={user.id}>{user.name}</div>
        ))
      )}
      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        {isFetchingNextPage ? 'Loading more...' : 'Load More'}
      </button>
    </div>
  );
}
```

---

## Prefetching

```typescript
// Prefetch on hover
const prefetchUser = (id: string) => {
  queryClient.prefetchQuery({
    queryKey: ['users', id],
    queryFn: () => fetchUser(id),
    staleTime: 5 * 60 * 1000,
  });
};

// In component
<Link
  href={`/users/${id}`}
  onMouseEnter={() => prefetchUser(id)}
>
  View User
</Link>
```

---

## Dependent Queries

```typescript
function UserProfile({ userId }: { userId: string }) {
  const userQuery = useUser(userId);

  const orgQuery = useQuery({
    queryKey: ['organizations', userQuery.data?.orgId],
    queryFn: () => fetchOrganization(userQuery.data?.orgId),
    enabled: !!userQuery.data?.orgId,
  });

  return (
    <div>
      {userQuery.data?.name}
      {orgQuery.data?.name}
    </div>
  );
}
```

---

## Anti-Patterns

### ❌ Client State for Server Data
```tsx
// BAD
const [users, setUsers] = useState([]);
useEffect(() => {
  fetch('/api/users').then(r => r.json()).then(setUsers);
}, []);
```

### ✅ Use React Query
```tsx
// GOOD
const { data: users } = useQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(r => r.json()),
});
```

### ❌ No Cache Invalidation
```tsx
// BAD
const mutation = useMutation({
  mutationFn: createTodo,
  // No invalidation
});
```

### ✅ Always Invalidate
```tsx
// GOOD
const mutation = useMutation({
  mutationFn: createTodo,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

---

## Production Checklist

- [ ] QueryClient configured with default options
- [ ] Devtools enabled in development
- [ ] Stale time configured appropriately
- [ ] Error handling on all queries/mutations
- [ ] Loading states handled
- [ ] Cache invalidation after mutations
- [ ] Optimistic updates for better UX
- [ ] Infinite queries for pagination

---

## Team Conventions

### Query Key Schema
```typescript
// Consistent key structure
['users']                    // List
['users', { page: 1 }]      // With params
['users', '123']             // Single
['users', '123', 'posts']   // Nested
```

### Hook Naming
```typescript
useUsers()           // Query
useUser(id)          // Query with param
useCreateUser()      // Mutation
useUpdateUser()      // Mutation
useDeleteUser()      // Mutation
```
