---
name: testing-library
description: Enterprise Testing Library 16.x with React, DOM, user-event, jest-dom matchers, and accessible testing patterns. Use when writing component tests, testing user interactions, or verifying accessibility.
metadata:
  stack: testing-library-16
  scope: testing
  version: "16.3"
---

# Testing Library 16.x Enterprise Guide

## Overview

Testing Library is a family of packages that help you test UI components in a user-centric way. It encourages testing behavior rather than implementation details.

### When to Use Testing Library
- Component unit testing
- User interaction testing
- Accessibility testing
- Integration testing with React

---

## Setup

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

---

## Basic Component Test

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

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
  });
});
```

---

## Async Testing

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { UserList } from './user-list';

it('loads and displays users', async () => {
  render(<UserList />);

  // Wait for async operation
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

---

## Form Testing

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

---

## Queries Priority

```typescript
// 1. getByRole - Best for accessibility
screen.getByRole('button', { name: /submit/i });

// 2. getByLabelText - Best for form fields
screen.getByLabelText(/email/i);

// 3. getByPlaceholderText - For inputs without labels
screen.getByPlaceholderText(/search/i);

// 4. getByText - For non-interactive elements
screen.getByText('Welcome');

// 5. getByTestId - Last resort
screen.getByTestId('submit-button');
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

- [ ] Queries use getByRole first
- [ ] Async elements use findBy
- [ ] userEvent used instead of fireEvent
- [ ] Accessibility tested
- [ ] Error states tested
- [ ] Loading states tested

---

## Team Conventions

### Query Selection
```typescript
// Priority order
1. getByRole      // Accessibility-first
2. getByLabelText // Form fields
3. getByText      // Non-interactive
4. getByTestId    // Last resort
```

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
