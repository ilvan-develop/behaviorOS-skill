---
name: prom-client
description: Enterprise prom-client 15.x Prometheus metrics with counters, histograms, gauges, and NestJS integration. Use when implementing metrics collection, monitoring endpoints, or performance dashboards.
metadata:
  stack: prom-client-15
  scope: monitoring
---

# prom-client Enterprise Metrics

## Overview

prom-client is a Prometheus client for Node.js. It provides counters, histograms, gauges, and other metric types for monitoring application performance.

**When to Use:**
- Implementing application monitoring
- Creating metrics endpoints for Prometheus
- Tracking HTTP request performance
- Monitoring database queries
- Building performance dashboards

**When NOT to Use:**
- Simple applications without monitoring needs
- Projects using external monitoring services
- Non-Node.js applications

## Architecture Patterns

### Project Structure
```
src/
├── monitoring/
│   ├── metrics.ts          # Metric definitions
│   ├── middleware.ts        # NestJS interceptors
│   ├── controller.ts        # Metrics endpoint
│   └── types.ts            # Metric types
├── modules/
│   └── users/
│       └── users.service.ts
└── main.ts
```

## Complete Configuration

### metrics.ts (Production)

```typescript
import {
  Counter,
  Histogram,
  Gauge,
  Summary,
  register,
  collectDefaultMetrics,
  Registry,
} from 'prom-client';

// Create custom registry
const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({
  prefix: 'finpay_',
  register,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  eventLoopMonitoringBuckets: [0.1, 1, 5, 10, 50],
});

// HTTP Request Duration
export const httpRequestDuration = new Histogram({
  name: 'finpay_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status', 'controller', 'handler'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// HTTP Request Total
export const httpRequestTotal = new Counter({
  name: 'finpay_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// Active Connections
export const activeConnections = new Gauge({
  name: 'finpay_active_connections',
  help: 'Number of active connections',
  registers: [register],
});

// Database Query Duration
export const dbQueryDuration = new Histogram({
  name: 'finpay_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Database Query Total
export const dbQueryTotal = new Counter({
  name: 'finpay_db_query_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [register],
});

// Business Metrics
export const paymentTotal = new Counter({
  name: 'finpay_payment_total',
  help: 'Total number of payments processed',
  labelNames: ['status', 'currency', 'method'],
  registers: [register],
});

export const paymentAmount = new Histogram({
  name: 'finpay_payment_amount',
  help: 'Payment amount in cents',
  labelNames: ['currency', 'method'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
  registers: [register],
});

// Cache Metrics
export const cacheHits = new Counter({
  name: 'finpay_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'finpay_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache'],
  registers: [register],
});

// Queue Metrics
export const queueSize = new Gauge({
  name: 'finpay_queue_size',
  help: 'Current size of the queue',
  labelNames: ['queue'],
  registers: [register],
});

export const queueProcessingTime = new Histogram({
  name: 'finpay_queue_processing_time_seconds',
  help: 'Time to process queue items',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});
```

### NestJS Interceptor

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import {
  httpRequestDuration,
  httpRequestTotal,
  activeConnections,
} from '../monitoring/metrics';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const start = Date.now();
    const controller = context.getClass().name;
    const handler = context.getHandler().name;

    activeConnections.inc();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.url;
        const status = res.statusCode;

        httpRequestDuration.observe(
          { method: req.method, route, status: status.toString(), controller, handler },
          duration
        );

        httpRequestTotal.inc({
          method: req.method,
          route,
          status: status.toString(),
        });

        activeConnections.dec();
      }),
      catchError((error) => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.url;
        const status = error.status || 500;

        httpRequestDuration.observe(
          { method: req.method, route, status: status.toString(), controller, handler },
          duration
        );

        httpRequestTotal.inc({
          method: req.method,
          route,
          status: status.toString(),
        });

        activeConnections.dec();

        throw error;
      })
    );
  }
}
```

### Metrics Endpoint

```typescript
import { Controller, Get, Res } from '@nestjs/common';
import { register } from 'prom-client';
import { Response } from 'express';

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res res: Response) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }

  @Get('json')
  async getMetricsJson() {
    const metrics = await register.getSingleMetricAsString();
    return { metrics };
  }
}
```

### Database Metrics Middleware

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { dbQueryDuration, dbQueryTotal } from '../monitoring/metrics';

@Injectable()
export class DatabaseMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const className = context.getClass().name;
    const methodName = context.getHandler().name;

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - start) / 1000;
        const operation = methodName;
        const table = this.extractTable(className);

        dbQueryDuration.observe(
          { operation, table, status: 'success' },
          duration
        );

        dbQueryTotal.inc({
          operation,
          table,
          status: 'success',
        });
      })
    );
  }

  private extractTable(className: string): string {
    // Extract table name from class name
    return className.replace('Service', '').toLowerCase();
  }
}
```

## Security Hardening

### Secure Metrics Endpoint
```typescript
import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { register } from 'prom-client';
import { Response } from 'express';

@Controller('metrics')
@UseGuards(AuthGuard)
export class MetricsController {
  @Get()
  async getMetrics(@Res res: Response) {
    // Only expose metrics to authenticated users
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
```

### Rate Limiting
```typescript
import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { register } from 'prom-client';
import { Response } from 'express';

@Controller('metrics')
@UseGuards(ThrottlerGuard)
export class MetricsController {
  @Get()
  async getMetrics(@Res res: Response) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
```

## Performance Optimization

### Efficient Metrics Collection
```typescript
// Use default metrics for system metrics
collectDefaultMetrics({
  prefix: 'finpay_',
  register,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  eventLoopMonitoringBuckets: [0.1, 1, 5, 10, 50],
});

// Use appropriate metric types
// Counter: for values that only increase
// Gauge: for values that can go up and down
// Histogram: for values with a distribution
// Summary: for quantiles
```

### Caching Metrics
```typescript
// Cache metrics output
let metricsCache: string | null = null;
let lastUpdate = 0;
const CACHE_DURATION = 10000; // 10 seconds

async function getMetrics(): Promise<string> {
  const now = Date.now();
  if (!metricsCache || now - lastUpdate > CACHE_DURATION) {
    metricsCache = await register.metrics();
    lastUpdate = now;
  }
  return metricsCache;
}
```

## Integration Patterns

### package.json Dependencies
```json
{
  "dependencies": {
    "prom-client": "^15.0.0"
  }
}
```

### NestJS Module
```typescript
import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class MetricsModule {}
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
    - run: npm run build
    - run: npm test
```

## Anti-Patterns

### ❌ DON'T
- Skip metrics in production: Always collect metrics
- Use wrong metric types: Use appropriate types
- Ignore label cardinality: Keep labels low cardinality
- Skip authentication: Secure metrics endpoint
- Cache indefinitely: Use short cache duration

### ✅ DO
- Use prefix for all metrics: `finpay_`
- Use appropriate metric types
- Keep label cardinality low
- Secure metrics endpoint
- Monitor metric collection performance
- Use default metrics for system metrics

## Troubleshooting

### Common Issues

**High Cardinality**
```typescript
// ❌ BAD: High cardinality labels
new Counter({
  name: 'requests_total',
  labelNames: ['user_id', 'timestamp'], // Too many values
});

// ✅ GOOD: Low cardinality labels
new Counter({
  name: 'requests_total',
  labelNames: ['method', 'route', 'status'], // Few values
});
```

**Memory Issues**
```typescript
// Use default metrics with appropriate buckets
collectDefaultMetrics({
  prefix: 'finpay_',
  register,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});
```

**Missing Metrics**
```typescript
// Ensure metrics are registered
const httpRequestDuration = new Histogram({
  name: 'finpay_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register], // Explicitly register
});
```

## Observability

### Metrics Collection
```typescript
// Monitor metrics collection
setInterval(async () => {
  const start = Date.now();
  await register.metrics();
  const duration = Date.now() - start;
  console.log(`Metrics collection took ${duration}ms`);
}, 60000);
```

### Metrics to Track
- HTTP request duration
- HTTP request total
- Active connections
- Database query duration
- Business metrics (payments, etc.)

## Production Checklist

- [ ] Default metrics collected
- [ ] HTTP metrics configured
- [ ] Database metrics configured
- [ ] Business metrics configured
- [ ] Metrics endpoint secured
- [ ] Metrics caching configured
- [ ] Label cardinality monitored
- [ ] CI/CD pipeline includes metrics
- [ ] Prometheus scraping configured
- [ ] Dashboards created

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
    - run: npm run build
    - run: npm test
```

### Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'finpay'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

## Team Conventions

- **Metric Naming**: Use `finpay_` prefix
- **Label Naming**: Use snake_case
- **Metric Types**: Use appropriate types (Counter, Gauge, Histogram)
- **Documentation**: Keep metrics documented
- **Monitoring**: Set up alerts for anomalies
- **Performance**: Monitor metric collection overhead
