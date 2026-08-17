---
name: forms
description: Enterprise React Hook Form v7 with Zod v4 validation, field arrays, server errors, multi-step forms, and performance optimization. Use when building forms, validating input, or handling form submissions.
metadata:
  stack: rhf-7-zod-4
  scope: forms
  version: "7.85"
---

# React Hook Form + Zod Enterprise Guide

## Overview

React Hook Form is a performance-oriented form validation library for React. Combined with Zod, it provides type-safe validation with excellent DX.

### When to Use React Hook Form + Zod
- Complex forms with multiple fields
- Forms requiring server-side validation
- Multi-step wizards
- Dynamic forms (field arrays)
- Forms needing excellent performance

---

## Basic Form

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginInput = z.infer<typeof loginSchema>;

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    reset,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      toast.success('Logged in successfully');
      reset();
    } catch (error) {
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={errors.email ? 'true' : 'false'}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          {...register('password')}
          aria-invalid={errors.password ? 'true' : 'false'}
        />
        {errors.password && (
          <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="rememberMe"
          {...register('rememberMe')}
          className="rounded border-gray-300"
        />
        <label htmlFor="rememberMe" className="text-sm">
          Remember me
        </label>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}
```

---

## Field Arrays

```tsx
const invoiceSchema = z.object({
  items: z.array(z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    price: z.number().min(0, 'Price must be positive'),
  })).min(1, 'At least one item required'),
  taxRate: z.number().min(0).max(100).default(10),
});

type InvoiceInput = z.infer<typeof invoiceSchema>;

export function InvoiceForm() {
  const { control, register, handleSubmit, watch, formState: { errors } } = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      items: [{ description: '', quantity: 1, price: 0 }],
      taxRate: 10,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const subtotal = watchedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const tax = subtotal * (watch('taxRate') / 100);
  const total = subtotal + tax;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <Input
                placeholder="Description"
                {...register(`items.${index}.description`)}
                aria-invalid={errors.items?.[index]?.description ? 'true' : 'false'}
              />
              {errors.items?.[index]?.description && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.items[index].description.message}
                </p>
              )}
            </div>
            <div>
              <Input
                type="number"
                placeholder="Qty"
                {...register(`items.${index}.quantity`, { valueAsNumber: true })}
              />
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Price"
                step="0.01"
                {...register(`items.${index}.price`, { valueAsNumber: true })}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
              >
                X
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ description: '', quantity: 1, price: 0 })}
      >
        Add Item
      </Button>

      <div className="text-right space-y-1">
        <p>Subtotal: ${subtotal.toFixed(2)}</p>
        <p>Tax: ${tax.toFixed(2)}</p>
        <p className="text-lg font-bold">Total: ${total.toFixed(2)}</p>
      </div>

      <Button type="submit">Create Invoice</Button>
    </form>
  );
}
```

---

## Server Error Handling

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

export function CreateUserForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });

  const onSubmit = async (data: CreateUserInput) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();

        if (result.errors) {
          // Handle field-level errors
          Object.entries(result.errors).forEach(([field, message]) => {
            setError(field as keyof CreateUserInput, {
              type: 'server',
              message: message as string,
            });
          });
        } else {
          // Handle general error
          throw new Error(result.message);
        }
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

---

## Multi-Step Form

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const step1Schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

const step2Schema = z.object({
  address: z.string().min(5),
  city: z.string().min(2),
});

const completeSchema = step1Schema.merge(step2Schema);

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;

export function MultiStepForm() {
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1 | null>(null);

  const step1Form = useForm<Step1>({
    resolver: zodResolver(step1Schema),
  });

  const step2Form = useForm<Step2>({
    resolver: zodResolver(step2Schema),
  });

  const handleStep1 = (data: Step1) => {
    setStep1Data(data);
    setStep(2);
  };

  const handleStep2 = async (data: Step2) => {
    const completeData = { ...step1Data, ...data };
    await submitForm(completeData);
  };

  return (
    <div>
      {step === 1 && (
        <form onSubmit={step1Form.handleSubmit(handleStep1)}>
          {/* Step 1 fields */}
          <Button type="submit">Next</Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={step2Form.handleSubmit(handleStep2)}>
          {/* Step 2 fields */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit">Submit</Button>
          </div>
        </form>
      )}
    </div>
  );
}
```

---

## Anti-Patterns

### ❌ Uncontrolled Inputs
```tsx
// BAD: No validation
<input name="email" />
```

### ✅ Controlled with Validation
```tsx
// GOOD: Full validation
<Input {...register('email')} aria-invalid={errors.email ? 'true' : 'false'} />
{errors.email && <p>{errors.email.message}</p>}
```

### ❌ Ignoring Server Errors
```tsx
// BAD
const onSubmit = async (data) => {
  await fetch('/api/users', { method: 'POST', body: JSON.stringify(data) });
};
```

### ✅ Handling Server Errors
```tsx
// GOOD
const onSubmit = async (data) => {
  const response = await fetch('/api/users', { method: 'POST', body: JSON.stringify(data) });
  if (!response.ok) {
    const error = await response.json();
    setError('email', { type: 'server', message: error.message });
  }
};
```

---

## Production Checklist

- [ ] Zod schema validates all fields
- [ ] Error messages are user-friendly
- [ ] Loading states shown during submission
- [ ] Server errors handled and displayed
- [ ] Form resets after successful submission
- [ ] Accessibility labels and aria-invalid
- [ ] Debounced validation for performance
- [ ] Field arrays tested with add/remove

---

## Team Conventions

### File Structure
```typescript
// schemas/validation.ts - Shared schemas
export const loginSchema = z.object({...});

// components/forms/login-form.tsx - Form component
export function LoginForm() {...}

// hooks/use-form-submit.ts - Custom submit hook
export function useFormSubmit() {...}
```

### Naming
- `useForm` for form setup
- `handleSubmit` for submission
- `formState` for form state
- `register` for field registration
