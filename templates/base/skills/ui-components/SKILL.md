---
name: ui-components
description: Enterprise UI component toolkit with class-variance-authority, clsx, tailwind-merge, lucide-react, sonner, recharts, and composition patterns. Use when building reusable UI components, toasts, icons, or charts.
metadata:
  stack: ui-toolkit
  scope: ui
---

# UI Components Enterprise Toolkit

## Overview

Enterprise UI component toolkit for building consistent, accessible, and maintainable user interfaces. Includes utility functions, component variants, icons, toasts, and charts.

**When to Use:**
- Building reusable UI component libraries
- Needing consistent styling patterns
- Implementing toast notifications
- Adding icons to UI
- Creating data visualizations with charts

**When NOT to Use:**
- Simple projects with minimal UI
- Projects using a complete UI framework (Material UI, Ant Design)
- Non-React projects

## Architecture Patterns

### Project Structure
```
components/
├── ui/
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── index.ts
├── icons/
│   └── index.tsx
├── toasts/
│   └── index.tsx
├── charts/
│   └── index.tsx
└── lib/
    └── utils.ts
```

## Complete Configuration

### cn() Utility (Essential)

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### class-variance-authority (CVA)

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
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

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

### Badge Component

```typescript
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-500 text-white',
        warning: 'border-transparent bg-yellow-500 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
```

## Lucide Icons

```tsx
import {
  ArrowRight,
  Check,
  ChevronDown,
  Search,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Trash,
  Edit,
  Plus,
  Minus,
  X,
  Menu,
  Home,
  Settings,
  Bell,
  Calendar,
  Clock,
  File,
  Folder,
  Image,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  Loader2,
} from 'lucide-react';

// Usage
<ArrowRight className="h-4 w-4" />
<Search className="h-5 w-5 text-muted-foreground" />
<button>
  <Check className="h-4 w-4 mr-2" />
  Confirm
</button>

// Icon with text
<div className="flex items-center gap-2">
  <Mail className="h-4 w-4" />
  <span>Email</span>
</div>

// Loading icon
<Loader2 className="h-4 w-4 animate-spin" />
```

## Sonner Toasts

```tsx
import { toast } from 'sonner';

// Basic toast
toast('Event has been created');

// Success/Error
toast.success('Saved successfully');
toast.error('Something went wrong');

// With description
toast('Event created', {
  description: 'Monday, January 3rd at 6:00 PM',
});

// Promise toast
toast.promise(saveData(), {
  loading: 'Saving...',
  success: 'Data saved!',
  error: 'Failed to save',
});

// Action toast
toast('Event created', {
  action: {
    label: 'Undo',
    onClick: () => undo(),
  },
});

// Custom toast
toast.custom((t) => (
  <div className="bg-white p-4 rounded shadow-lg">
    Custom toast content
  </div>
));

// Dismiss toast
toast.dismiss('toast-id');

// In React component
import { Toaster } from 'sonner';

function App() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={5000}
    />
  );
}
```

## Recharts

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

// Bar Chart
function RevenueChart({ data }: { data: RevenueData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Line Chart
function TrendChart({ data }: { data: TrendData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Pie Chart
function StatusChart({ data }: { data: StatusData[] }) {
  const COLORS = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b'];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          dataKey="value"
          label
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Area Chart
function RevenueAreaChart({ data }: { data: RevenueData[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.3}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

## Security Hardening

### Safe Component Patterns
```typescript
// Avoid dangerouslySetInnerHTML
// ❌ BAD
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// ✅ GOOD
<div>{userContent}</div>

// Sanitize user input
import DOMPurify from 'dompurify';

const sanitizedContent = DOMPurify.sanitize(userContent);
<div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
```

## Performance Optimization

### Memoization
```typescript
import { memo, useMemo } from 'react';

const MemoizedButton = memo(Button);

function ParentComponent() {
  const memoizedProps = useMemo(() => ({
    variant: 'default',
    size: 'lg',
  }), []);

  return <MemoizedButton {...memoizedProps}>Click me</MemoizedButton>;
}
```

### Lazy Loading
```typescript
const LazyChart = lazy(() => import('./charts/RevenueChart'));

function Dashboard() {
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <LazyChart data={chartData} />
    </Suspense>
  );
}
```

## Integration Patterns

### package.json Dependencies
```json
{
  "dependencies": {
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "lucide-react": "^0.400.0",
    "sonner": "^1.0.0",
    "recharts": "^2.0.0"
  }
}
```

### CI/CD Pipeline
```yaml
# .github/workflows/build.yml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - run: npm run typecheck
    - run: npm run build
```

## Anti-Patterns

### ❌ DON'T
- Use inline styles: Use Tailwind classes
- Skip accessibility: Always add ARIA attributes
- Use deprecated APIs: Keep dependencies updated
- Ignore bundle size: Monitor component imports
- Skip type safety: Use TypeScript interfaces

### ✅ DO
- Use `cn()` for conditional classes
- Use CVA for component variants
- Use `lucide-react` for icons (tree-shakeable)
- Use `sonner` for toasts
- Use `ResponsiveContainer` for Recharts
- Use `twMerge` for conflicting classes

---

## Anti-Patterns FinPay

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

### ❌ Semânticos Incorretos
```tsx
// ❌ Usar cores hardcoded em vez de semânticas
<div className="bg-blue-500 text-white">
  Cores incorrectas
</div>
```

### ✅ Semânticos Correctos
```tsx
// ✅ Usar tokens semânticos do design system
<div className="bg-primary text-primary-foreground">
  Cores correctas
</div>
```

### ❌ Componentes sem meta.ts
```tsx
// ❌ Componente sem documentação
export function PaymentCard({ amount, status }) {
  return <div>{amount}</div>;
}
```

### ✅ Componentes com meta.ts
```tsx
// ✅ Componente documentado
// meta.ts
export const paymentCardMeta = {
  name: 'PaymentCard',
  description: 'Exibe detalhes de um pagamento',
  category: 'finance',
  variants: ['default', 'compact'],
  a11y: 'contrast',
};
```

### ❌ Hex em vez de Tokens
```tsx
// ❌ Cores hardcoded
<div style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
  Cores hardcoded
</div>
```

### ✅ Tokens Semânticos
```tsx
// ✅ Cores do design system
<div className="bg-background text-foreground">
  Cores semânticas
</div>
```

### ❌ Mais de 4 Variantes de Botão
```tsx
// ❌ Excesso de variantes - difícil de manter
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="tertiary">Tertiary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="outline">Outline</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="link">Link</Button>
```

### ✅ Máximo 4 Variantes
```tsx
// ✅ Variantes essenciais
<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="destructive">Destructive</Button>
```

### ❌ DecisionPanel sem reason
```tsx
// ❌ Decisão sem explicação
<DecisionPanel decision="approved" />
```

### ✅ DecisionPanel com reason
```tsx
// ✅ Decisão com explicação
<DecisionPanel decision="approved" reason="Documentação válida" />
```

### ❌ Montantes com String Interpolation
```tsx
// ❌ Formatação manual
<span>{`Kz ${amount}`}</span>
```

### ✅ Montantes com FinancialAmount
```tsx
// ✅ Formatação compartilhada
import { FinancialAmount } from '@finpay/ui';
<FinancialAmount value={amount} currency="AOA" />
```

---

## Troubleshooting

### Common Issues

**Tailwind Classes Not Working**
```typescript
// Ensure cn() is imported
import { cn } from '@/lib/utils';

// Use cn() for conditional classes
<div className={cn('base-class', isActive && 'active-class')} />
```

**Recharts Not Rendering**
```typescript
// Wrap with ResponsiveContainer
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    {/* Chart components */}
  </BarChart>
</ResponsiveContainer>
```

**Toast Not Showing**
```typescript
// Ensure Toaster is mounted
import { Toaster } from 'sonner';

function App() {
  return <Toaster />;
}
```

## Observability

### Component Metrics
- Render time
- Bundle size per component
- Accessibility score
- Usage frequency

## Production Checklist

- [ ] `cn()` utility implemented
- [ ] Component variants defined
- [ ] Accessibility attributes added
- [ ] Bundle size monitored
- [ ] TypeScript types defined
- [ ] Tests written
- [ ] Documentation updated
- [ ] CI/CD pipeline passes

## CI/CD Integration

### GitHub Actions
```yaml
build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'npm'
    - run: npm ci
    - run: npm run typecheck
    - run: npm run build
    - run: npm test
```

## Team Conventions

- **Component Location**: `src/components/ui/`
- **Styling**: Use Tailwind classes with `cn()` utility
- **Variants**: Use CVA for component variants
- **Icons**: Use `lucide-react`
- **Toasts**: Use `sonner`
- **Charts**: Use `recharts` with `ResponsiveContainer`
- **Documentation**: Keep component docs updated
