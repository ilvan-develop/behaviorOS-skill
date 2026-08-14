---
name: storybook
description: Enterprise Storybook 10.x component documentation with controls, actions, docs, addons, visual testing, and accessibility. Use when documenting UI components, creating component stories, or setting up Storybook.
metadata:
  stack: storybook-10
  scope: docs
  version: "10.5"
---

# Storybook 10 Enterprise Component Documentation Guide

## Overview

Storybook is a UI component explorer that helps teams develop, document, and test components in isolation.

### When to Use Storybook
- Component library development
- Design system documentation
- Visual regression testing
- Component isolation for development
- Team collaboration on UI components

---

## Setup

```bash
npx storybook@latest init
```

## Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-links',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
    defaultName: 'Documentation',
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },
};

export default config;
```

```typescript
// .storybook/preview.ts
import type { Preview } from '@storybook/react';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {},
      options: {
        checks: ['color-contrast'],
        runOn: ['focus', 'blur'],
      },
    },
    layout: 'centered',
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0f172a' },
      ],
    },
  },
};

export default preview;
```

---

## Story Format (CSF 3.0)

```tsx
// components/ui/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: 'Button size',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the button',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading spinner',
    },
  },
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'default',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Delete',
    variant: 'destructive',
  },
};

export const Loading: Story = {
  args: {
    children: 'Loading...',
    loading: true,
    disabled: true,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};
```

---

## Interaction Tests

```tsx
import { expect, userEvent, within } from '@storybook/test';

export const ClickTest: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');

    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
    await expect(button).toHaveFocus();
  },
};

export const FormSubmission: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(canvas.getByLabelText(/password/i), 'password123');
    await userEvent.click(canvas.getByRole('button', { name: /submit/i }));

    await expect(canvas.getByText('Success!')).toBeInTheDocument();
  },
};
```

---

## Decorators

```tsx
// Theme decorator
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme || 'light';
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <Story />
    </div>
  );
};

// Provider wrapper
const withProviders: Decorator = (Story) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <Story />
    </ThemeProvider>
  </QueryClientProvider>
);
```

---

## Commands

```bash
# Start Storybook
npm run storybook

# Build for deployment
npm run build-storybook

# Test Storybook
npx test-storybook
```

---

## Production Checklist

- [ ] autodocs enabled for all components
- [ ] a11y addon configured
- [ ] Interaction tests written
- [ ] Visual regression tests set up
- [ ] Design tokens documented
- [ ] Component variants all shown
- [ ] Accessibility checked
- [ ] Build optimized for deployment

---

## Team Conventions

### Story Naming
```typescript
// Consistent naming
'UI/Button/Default'
'UI/Button/Destructive'
'Dashboard/StatsCards/Loading'
```

### File Structure
```typescript
// components/ui/button.tsx        - Component
// components/ui/button.stories.tsx - Stories
// components/ui/button.test.tsx   - Unit tests
// components/ui/button.mdx        - Documentation
```
