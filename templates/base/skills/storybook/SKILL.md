---
name: storybook
description: Storybook for component documentation, visual testing, and interaction testing. Use when creating stories, documenting components, or setting up visual regression tests.
metadata:
  stack: storybook-8
  scope: frontend
  version: "8.3"
---

# Storybook 8 Enterprise Guide

## Overview

Storybook is a tool for developing UI components in isolation. It provides a sandbox for building, testing, and documenting components.

### When to Use Storybook
- Documenting component library
- Visual testing and regression
- Interaction testing
- Design system development
- Component development workflow

---

## Project Structure

```
src/
├── stories/
│   ├── components/
│   │   ├── Button.stories.tsx
│   │   ├── Card.stories.tsx
│   │   └── ...
│   ├── foundations/
│   │   ├── Colors.stories.tsx
│   │   ├── Typography.stories.tsx
│   │   └── ...
│   └── templates/
│       ├── Dashboard.stories.tsx
│       └── ...
├── .storybook/
│   ├── main.ts
│   ├── preview.ts
│   └── manager.ts
```

---

## Creating Stories

### Basic Story
```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'destructive'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'default',
    size: 'md',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary',
    variant: 'secondary',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
};
```

### Story with Controls
```tsx
// Card.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Molecules/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Card content goes here.</p>
      </CardContent>
    </Card>
  ),
};
```

### Story with State
```tsx
// Counter.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Counter } from './Counter';

const meta: Meta<typeof Counter> = {
  title: 'Molecules/Counter',
  component: Counter,
};

export default meta;
type Story = StoryObj<typeof Counter>;

const CounterWithState = () => {
  const [count, setCount] = useState(0);
  return <Counter count={count} onIncrement={() => setCount(c => c + 1)} />;
};

export const Default: Story = {
  render: () => <CounterWithState />,
};
```

---

## Accessibility Testing

### Adding a11y Checks
```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { within, expect } from '@storybook/test';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    a11y: {
      element: '#root',
      config: {},
      options: {},
      manual: false,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Accessible: Story = {
  args: {
    children: 'Accessible Button',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');
    await expect(button).toBeAccessible();
  },
};
```

---

## Interaction Testing

### Basic Interaction
```tsx
// Form.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect } from '@storybook/test';
import { Form } from './Form';

const meta: Meta<typeof Form> = {
  title: 'Molecules/Form',
  component: Form,
};

export default meta;
type Story = StoryObj<typeof Form>;

export const SubmitForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Type in input
    await userEvent.type(canvas.getByLabelText('Email'), 'user@example.com');
    
    // Click submit
    await userEvent.click(canvas.getByRole('button', { name: 'Submit' }));
    
    // Expect success message
    await expect(canvas.getByText('Success!')).toBeInTheDocument();
  },
};
```

### Complex Interaction
```tsx
// Dashboard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent, expect, waitFor } from '@storybook/test';
import { Dashboard } from './Dashboard';

const meta: Meta<typeof Dashboard> = {
  title: 'Templates/Dashboard',
  component: Dashboard,
};

export default meta;
type Story = StoryObj<typeof Dashboard>;

export const NavigateDashboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Click on navigation item
    await userEvent.click(canvas.getByText('Payments'));
    
    // Wait for content to load
    await waitFor(() => {
      expect(canvas.getByText('Payment List')).toBeInTheDocument();
    });
    
    // Click on a payment
    await userEvent.click(canvas.getByText('Payment #123'));
    
    // Verify detail view
    await expect(canvas.getByText('Payment Details')).toBeInTheDocument();
  },
};
```

---

## Visual Regression

### Adding Visual Tests
```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  parameters: {
    layout: 'centered',
   chromatic: {
      viewports: [320, 768, 1200],
      delay: 500,
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '8px' }}>
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
};
```

---

## Configuration

### main.ts
```typescript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  staticDirs: ['../public'],
};

export default config;
```

### preview.ts
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
      element: '#root',
      config: {},
      options: {},
    },
  },
};

export default preview;
```

---

## Anti-Patterns

### ❌ Stories sem meta.ts
```tsx
// ❌ Componente sem documentação
export const Button = ({ children }) => <button>{children}</button>;
```

### ✅ Stories com meta.ts
```tsx
// ✅ Componente documentado
// meta.ts
export const buttonMeta = {
  name: 'Button',
  description: 'Botão interativo para ações',
  category: 'atoms',
  variants: ['default', 'secondary', 'outline', 'destructive'],
  a11y: 'contrast',
};
```

### ❌ Stories sem a11y Checks
```tsx
// ❌ Sem verificação de acessibilidade
export const Default: Story = {
  args: { children: 'Button' },
};
```

### ✅ Stories com a11y Checks
```tsx
// ✅ Com verificação de acessibilidade
export const Default: Story = {
  args: { children: 'Button' },
  parameters: {
    a11y: {
      element: '#root',
    },
  },
};
```

### ❌ Stories sem Interaction Tests
```tsx
// ❌ Sem testes de interação
export const Submit: Story = {
  args: { children: 'Submit' },
};
```

### ✅ Stories com Interaction Tests
```tsx
// ✅ Com testes de interação
export const Submit: Story = {
  args: { children: 'Submit' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
  },
};
```

### ❌ Stories sem Controles
```tsx
// ❌ Sem controles para variação
export const Default: Story = {
  render: () => <Button>Click me</Button>,
};
```

### ✅ Stories com Controles
```tsx
// ✅ Com controles para variação
export const Default: Story = {
  args: {
    children: 'Click me',
    variant: 'default',
    size: 'md',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'outline', 'destructive'],
    },
  },
};
```

---

## Production Checklist

- [ ] `meta.ts` defined for all components
- [ ] a11y checks enabled
- [ ] Interaction tests added
- [ ] Controls configured
- [ ] Visual regression tests
- [ ] Documentation updated
- [ ] Autodocs enabled
- [ ] Viewports configured

---

## Team Conventions

### File Structure
- `src/stories/components/` - Component stories
- `src/stories/foundations/` - Foundation stories
- `src/stories/templates/` - Template stories

### Naming
- `{ComponentName}.stories.tsx` for stories
- `{ComponentName}.meta.ts` for metadata
- PascalCase for component names
- kebab-case for file names

### Documentation
- All components must have stories
- All stories must have metadata
- All stories should have a11y checks
- All stories should have controls
