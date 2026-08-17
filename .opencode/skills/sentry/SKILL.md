---
name: sentry
description: Enterprise Sentry 10.x error monitoring with Node.js and Next.js integration, performance tracing, session replay, source maps, and alerting. Use when setting up error tracking, performance monitoring, or debugging production issues.
metadata:
  stack: sentry-10
  scope: monitoring
  version: "10.70"
---

# Sentry 10.x Enterprise Error Monitoring Guide

## Overview

Sentry is a platform for error monitoring that helps developers identify and fix issues in real-time. It provides error tracking, performance monitoring, session replay, and alerting.

### When to Use Sentry
- Production error tracking and alerting
- Performance monitoring and optimization
- Debugging issues in production
- Tracking user impact of errors
- Monitoring application health

---

## Node.js Setup (NestJS)

```typescript
// src/instrument.ts (MUST be first import)
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  integrations: [
    Sentry.httpIntegration({ breadcrumbs: true }),
    Sentry.prismaIntegration(),
    Sentry.consoleIntegration(),
    Sentry.localVariablesIntegration(),
    nodeProfilingIntegration(),
  ],
  beforeSend(event) {
    // Strip sensitive data
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    if (event.request?.data) {
      delete event.request.data.password;
      delete event.request.data.token;
    }
    return event;
  },
  tracesSampler: ({ name }) => {
    // Don't trace health checks
    if (name === 'GET /health') return 0;
    return 0.1;
  },
});
```

```typescript
// main.ts
import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Setup Sentry error handler
  Sentry.setupNestErrorHandler(app);

  await app.listen(3000);
}
bootstrap();
```

---

## Next.js Setup

```typescript
// next.config.ts
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  // Your existing Next.js config
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.npm_package_version,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
    Sentry.browserProfilingIntegration(),
  ],
  beforeSend(event) {
    if (event.request?.cookies) {
      delete event.request.cookies;
    }
    return event;
  },
});
```

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  integrations: [
    Sentry.httpIntegration(),
    Sentry.prismaIntegration(),
  ],
});
```

---

## Error Capture

```typescript
// Manual error capture
import * as Sentry from '@sentry/node';

try {
  await processPayment(orderId);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      module: 'payments',
      orderId,
      userId: user.id,
    },
    extra: {
      orderId,
      amount: order.total,
      currency: order.currency,
    },
    level: 'error',
  });
  throw error;
}

// Capture message
Sentry.captureMessage('Payment gateway timeout', 'warning');
Sentry.captureMessage('Rate limit exceeded', 'info');

// Capture with context
Sentry.withScope((scope) => {
  scope.setTag('feature', 'checkout');
  scope.setUser({ id: user.id, email: user.email });
  scope.setExtra('cartItems', cart.items.length);
  Sentry.captureException(error);
});
```

---

## Performance Tracing

```typescript
// Transaction
const transaction = Sentry.startTransaction({
  name: 'process-order',
  op: 'order.process',
});

try {
  // Add child span
  const validateSpan = transaction.startChild({ op: 'validate' });
  await validateOrder(order);
  validateSpan.finish();

  const paymentSpan = transaction.startChild({ op: 'payment' });
  await chargePayment(order);
  paymentSpan.finish();

  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}

// Automatic instrumentation with @sentry/node
Sentry.withSpan({ name: 'db-query', op: 'query' }, () => {
  return prisma.user.findMany();
});
```

---

## NestJS Interceptor

```typescript
// common/interceptors/sentry.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const transaction = Sentry.startTransaction({
      name: `${req.method} ${req.route?.path || req.url}`,
      op: 'http',
    });

    Sentry.configureScope((scope) => {
      scope.setSpan(transaction);
      scope.setTag('http.method', req.method);
      scope.setTag('http.url', req.url);
      scope.setUser({ ip_address: req.ip });
    });

    return next.handle().pipe(
      tap({
        next: () => {
          transaction.setStatus('ok');
        },
        error: (error) => {
          transaction.setStatus('internal_error');
          Sentry.captureException(error);
        },
        complete: () => {
          transaction.finish();
        },
      }),
    );
  }
}
```

---

## Cron Monitoring

```typescript
// Use withMonitor for cron jobs
import * as Sentry from '@sentry/node';

async function runDailyReport() {
  await Sentry.withMonitor('daily-report', async () => {
    await generateReport();
  });
}

// With configuration
await Sentry.withMonitor(
  'cleanup-expired-sessions',
  async () => {
    await cleanupExpiredSessions();
  },
  {
    schedule: { type: 'crontab', value: '0 2 * * *' }, // Daily at 2 AM
    maxRuntime: 300, // 5 minutes
    failureIssueThreshold: 3,
  }
);
```

---

## Source Maps (Next.js)

```bash
# Install Sentry CLI
npm install @sentry/cli --save-dev

# Upload source maps
npx sentry-cli sourcemaps inject .next
npx sentry-cli sourcemaps upload .next --org=$SENTRY_ORG --project=$SENTRY_PROJECT
```

---

## Anti-Patterns

### ❌ Swallowing Errors
```typescript
// BAD
try {
  await riskyOperation();
} catch (error) {
  console.error(error); // Lost in logs
}
```

### ✅ Capturing to Sentry
```typescript
// GOOD
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error);
  throw error; // Re-throw if needed
}
```

### ❌ No Context
```typescript
// BAD
Sentry.captureException(error);
```

### ✅ Rich Context
```typescript
// GOOD
Sentry.withScope((scope) => {
  scope.setTag('userId', user.id);
  scope.setTag('operation', 'payment');
  scope.setExtra('amount', amount);
  Sentry.captureException(error);
});
```

---

## Production Checklist

- [ ] DSN configured via environment variable
- [ ] Source maps uploaded in CI/CD
- [ ] Sensitive data stripped in `beforeSend`
- [ ] Performance tracing enabled (10% sample rate)
- [ ] Cron monitoring configured
- [ ] Alert rules configured for critical errors
- [ ] Release tracking enabled
- [ ] User context set on authentication
- [ ] Tags applied for filtering
- [ ] Session replay configured (if using Next.js)

---

## Team Conventions

### Error Tags
```typescript
// Consistent tag schema
{
  module: 'payments' | 'auth' | 'users' | 'notifications',
  operation: 'create' | 'update' | 'delete' | 'fetch',
  userId: string,
  requestId: string,
}
```

### Alert Rules
- Critical: Error rate > 5% for 5 minutes
- Warning: Error rate > 1% for 10 minutes
- Info: New issue created

### Sentry Workflow
1. Error occurs in production
2. Sentry captures with context
3. Alert sent to Slack/email
4. Developer investigates with context
5. Fix deployed
6. Issue auto-resolved if no new events
