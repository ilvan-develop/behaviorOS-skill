---
name: tailwind
description: Enterprise Tailwind CSS v4 with Vite integration, custom themes, design tokens, responsive design, dark mode, and utility patterns. Use when styling components, configuring themes, or working with Tailwind CSS.
metadata:
  stack: tailwind-4
  scope: css
  version: "4.3"
---

# Tailwind CSS v4 Enterprise Guide

## Overview

Tailwind CSS is a utility-first CSS framework that provides low-level utility classes to build custom designs without leaving your HTML/JSX.

### When to Use Tailwind CSS
- Rapid UI development with utility classes
- Design systems with consistent spacing/colors
- Projects needing responsive, mobile-first design
- Teams wanting to avoid custom CSS
- Applications requiring dark mode support

---

## CSS Setup (src/app/globals.css)

```css
@import "tailwindcss";

/* ============================================
   Design Tokens
   ============================================ */

@theme {
  /* Colors */
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-card: #ffffff;
  --color-card-foreground: #0f172a;
  --color-popover: #ffffff;
  --color-popover-foreground: #0f172a;
  --color-primary: #6366f1;
  --color-primary-foreground: #ffffff;
  --color-secondary: #f1f5f9;
  --color-secondary-foreground: #0f172a;
  --color-muted: #f1f5f9;
  --color-muted-foreground: #64748b;
  --color-accent: #f1f5f9;
  --color-accent-foreground: #0f172a;
  --color-destructive: #ef4444;
  --color-destructive-foreground: #ffffff;
  --color-border: #e2e8f0;
  --color-input: #e2e8f0;
  --color-ring: #6366f1;

  /* Semantic Colors */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Fonts */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-full: 9999px;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

  /* Animations */
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;

  @keyframes accordion-down {
    from { height: 0; }
    to { height: var(--radix-accordion-content-height); }
  }

  @keyframes accordion-up {
    from { height: var(--radix-accordion-content-height); }
    to { height: 0; }
  }
}

/* ============================================
   Dark Mode
   ============================================ */

@variant dark (&:where(.dark, .dark *));

/* ============================================
   Base Styles
   ============================================ */

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }

  :focus-visible {
    @apply outline-ring outline-2 outline-offset-2;
  }
}

/* ============================================
   Component Utilities
   ============================================ */

@layer utilities {
  .container-2xl {
    max-width: 80rem;
  }

  .text-balance {
    text-wrap: balance;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

---

## Vite Integration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
});
```

---

## Component Patterns

### cn() Utility (Essential)

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Button with CVA

```tsx
// components/ui/button.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

### Card Component

```tsx
// components/ui/card.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

### Input Component

```tsx
// components/ui/input.tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
```

---

## Responsive Design

```tsx
// Mobile-first responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {items.map((item) => (
    <div key={item.id} className="col-span-1">{item.name}</div>
  ))}
</div>

// Responsive typography
<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">
  Responsive Heading
</h1>

// Responsive padding
<div className="p-4 sm:p-6 md:p-8 lg:p-10">
  Content with responsive padding
</div>
```

---

## Dark Mode

```tsx
// System preference detection
<html className="dark" suppressHydrationWarning>
  <body className="bg-background text-foreground">
    <div className="bg-white dark:bg-gray-900 text-black dark:text-white">
      Theme-aware content
    </div>
  </body>
</html>

// Theme toggle component
'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
```

---

## Anti-Patterns

### ❌ Inline Styles for Complex UI
```tsx
// BAD
<div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
  Content
</div>
```

### ✅ Utility Classes
```tsx
// GOOD
<div className="flex justify-center p-4">
  Content
</div>
```

### ❌ Inconsistent Spacing
```tsx
// BAD: Random spacing values
<div className="p-3 px-5 py-2.5 m-1.5">
  Inconsistent
</div>
```

### ✅ Consistent Spacing
```tsx
// GOOD: Use theme spacing
<div className="p-4">
  Consistent
</div>
```

---

## Anti-Patterns FinPay

### ❌ Hex Hard-Coded em Classes Tailwind
```tsx
// ❌ Nunca usar hex em classes
<div className="bg-[#1a1a1a] text-[#ffffff]">
  Cores hardcoded
</div>
```

### ✅ Usar Tokens Semânticos
```tsx
// ✅ SEMPRE usar tokens do design system
<div className="bg-background text-foreground">
  Cores semânticas
</div>
```

### ❌ dark: em vez de Tokens Semânticos
```tsx
// ❌ Lógica de tema manual
<div className="bg-white dark:bg-black">
  Tema manual
</div>
```

### ✅ Tokens Semânticos para Tema
```tsx
// ✅ Tokens resolvem automaticamente
<div className="bg-card text-card-foreground">
  Tema automático
</div>
```

### ❌ Responsive sem Mobile-First
```tsx
// ❌ Desktop-first - mais código
<div className="hidden md:block lg:flex">
  Desktop-first
</div>
```

### ✅ Mobile-First
```tsx
// ✅ Mobile-first - menos código
<div className="flex md:hidden lg:flex">
  Mobile-first
</div>
```

### ❌ Classes Duplicadas
```tsx
// ❌ Classes redundantes
<div className="p-4 m-4 p-2">
  Duplicado
</div>
```

### ✅ Classes Limpa
```tsx
// ✅ Sem duplicação
<div className="p-2 m-4">
  Limpo
</div>
```

### ❌ Inline Styles em vez de Tailwind
```tsx
// ❌ Bypass do Tailwind
<div style={{ color: 'red', fontSize: '16px' }}>
  Inline styles
</div>
```

### ✅ Classes Tailwind
```tsx
// ✅ Usar utilitários
<div className="text-red-500 text-base">
  Classes Tailwind
</div>
```

---

## Production Checklist

- [ ] Design tokens defined in `@theme`
- [ ] Dark mode configured
- [ ] cn() utility created
- [ ] Component variants using CVA
- [ ] Responsive breakpoints tested
- [ ] Accessibility colors checked (contrast)
- [ ] Unused CSS purged
- [ ] Fonts optimized (display: swap)

---

## Team Conventions

### Class Order
```tsx
// Consistent class order
className={cn(
  // Positioning
  'absolute inset-0',
  // Display
  'flex items-center justify-center',
  // Spacing
  'p-4 gap-4',
  // Sizing
  'w-full h-full',
  // Typography
  'text-sm font-medium',
  // Colors
  'bg-background text-foreground',
  // Borders
  'rounded-lg border',
  // Effects
  'shadow-sm',
  // Transitions
  'transition-colors',
  // States
  'hover:bg-accent',
  // Responsive
  'md:text-base',
  // Custom
  className
)}
```

### Naming Conventions
- `bg-primary` for brand colors
- `bg-destructive` for error/danger states
- `bg-muted` for subtle backgrounds
- `text-foreground` for main text
- `text-muted-foreground` for secondary text
