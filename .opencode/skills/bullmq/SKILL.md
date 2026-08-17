---
name: bullmq
description: Enterprise BullMQ 5.x job queues with Redis, workers, rate limiting, retries, job scheduling, and monitoring. Use when setting up background jobs, task queues, or scheduled processing.
metadata:
  stack: bullmq-5
  scope: infrastructure
  version: "5.79"
---

# BullMQ 5.x Enterprise Job Queue Guide

## Overview

BullMQ is a fast and robust Node.js queue library built on Redis. It provides features like rate limiting, retries, delays, priority queues, and job dependencies.

### When to Use BullMQ
- Background job processing (emails, reports, exports)
- Task scheduling (cron jobs, delayed tasks)
- Rate-limited API calls
- Multi-step workflows with dependencies
- Distributed task processing

### Alternatives Considered
| Solution | Pros | Cons | When to Choose BullMQ |
|----------|------|------|----------------------|
| Agenda | MongoDB-based | Slower, less features | Need MongoDB integration |
| bee-queue | Simple | No rate limiting, no Redis Cluster | Simple use cases |
| RabbitMQ | Feature-rich | Complex setup | Need complex routing |
| AWS SQS | Managed | Vendor lock-in | Need managed solution |

---

## Queue Setup

```typescript
// src/queues/email.queue.ts
import { Queue } from 'bullmq';
import { defaultConnection } from '../config/redis';

export const emailQueue = new Queue('emails', {
  connection: defaultConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // 24 hours
    },
  },
  prefix: 'bull',
});
```

```typescript
// src/queues/payment.queue.ts
import { Queue } from 'bullmq';
import { defaultConnection } from '../config/redis';

export const paymentQueue = new Queue('payments', {
  connection: defaultConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 604800 }, // 7 days
  },
});
```

---

## Worker Implementation

```typescript
// src/workers/email.worker.ts
import { Worker, Job } from 'bullmq';
import { defaultConnection } from '../config/redis';
import { Logger } from '@nestjs/common';
import { sendEmail, sendBulkEmail } from '../lib/mailer';

const logger = new Logger('EmailWorker');

export const emailWorker = new Worker(
  'emails',
  async (job: Job) => {
    logger.log(`Processing job ${job.id}: ${job.name}`);

    switch (job.name) {
      case 'send-welcome':
        return handleWelcomeEmail(job);
      case 'send-reset':
        return handleResetEmail(job);
      case 'send-bulk':
        return handleBulkEmail(job);
      case 'send-notification':
        return handleNotification(job);
      default:
        throw new Error(`Unknown job: ${job.name}`);
    }
  },
  {
    connection: defaultConnection,
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 60000, // 100 emails per minute
    },
  }
);

// Event handlers
emailWorker.on('completed', (job, result) => {
  logger.log(`Job ${job.id} completed: ${JSON.stringify(result)}`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed: ${err.message}`);
});

emailWorker.on('stalled', (jobId) => {
  logger.warn(`Job ${jobId} stalled`);
});

// Job handlers
async function handleWelcomeEmail(job: Job) {
  const { email, name } = job.data;
  await job.updateProgress(10);

  await sendEmail({
    to: email,
    subject: 'Welcome to FinPay!',
    template: 'welcome',
    data: { name },
  });

  await job.updateProgress(100);
  return { success: true, email };
}

async function handleBulkEmail(job: Job) {
  const { recipients, subject, template, data } = job.data;
  const total = recipients.length;

  for (let i = 0; i < total; i++) {
    const recipient = recipients[i];
    await sendEmail({ to: recipient.email, subject, template, data });
    await job.updateProgress(Math.round(((i + 1) / total) * 100));
  }

  return { sent: total };
}
```

---

## Adding Jobs

```typescript
// Basic job
await emailQueue.add('send-welcome', {
  email: 'user@example.com',
  name: 'John Doe',
});

// Delayed job (5 minutes from now)
await emailQueue.add('send-reminder', {
  email: 'user@example.com',
  template: 'reminder',
}, {
  delay: 5 * 60 * 1000,
});

// Repeatable job (cron)
await emailQueue.add('daily-report', {}, {
  repeat: {
    pattern: '0 9 * * *', // Every day at 9 AM
    tz: 'America/New_York',
  },
});

// Priority queue
await emailQueue.add('urgent-notification', {
  email: 'admin@example.com',
  priority: 'high',
}, {
  priority: 1, // Higher priority = processed first
});

// Job with custom ID
await emailQueue.add('send-email', data, {
  jobId: `email-${userId}-${Date.now()}`,
});
```

---

## Rate Limiting

```typescript
// Worker with rate limiting
const worker = new Worker('api-calls', handler, {
  connection: defaultConnection,
  limiter: {
    max: 100, // Max 100 jobs
    duration: 60000, // Per minute
  },
});

// Different limits per job type
const apiWorker = new Worker('api', handler, {
  connection: defaultConnection,
  limiter: {
    max: 50,
    duration: 60000,
  },
});
```

---

## Job Dependencies (FlowProducer)

```typescript
import { FlowProducer } from 'bullmq';

const flow = new FlowProducer({ connection: defaultConnection });

await flow.add({
  name: 'process-order',
  queueName: 'orders',
  data: { orderId: '123' },
  children: [
    {
      name: 'charge-payment',
      queueName: 'payments',
      data: { orderId: '123', amount: 100 },
    },
    {
      name: 'send-confirmation',
      queueName: 'emails',
      data: { orderId: '123', email: 'user@example.com' },
      opts: {
        dependency: {
          parent: { queueName: 'payments', id: 'payment-job-id' },
        },
      },
    },
  ],
});
```

---

## NestJS Integration

```typescript
// src/queues/queues.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from './processors/email.processor';
import { PaymentProcessor } from './processors/payment.processor';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    BullModule.registerQueue(
      { name: 'emails' },
      { name: 'payments' },
    ),
  ],
  providers: [EmailProcessor, PaymentProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
```

```typescript
// src/queues/processors/email.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('emails')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing email job ${job.id}: ${job.name}`);
    // Process email...
    return { success: true };
  }
}
```

---

## Monitoring

```typescript
// Get queue statistics
const counts = await emailQueue.getCounts();
// { waiting: 5, active: 2, completed: 100, failed: 3, delayed: 10 }

// Get jobs by status
const waitingJobs = await emailQueue.getWaiting(0, 10);
const activeJobs = await emailQueue.getActive(0, 10);
const completedJobs = await emailQueue.getCompleted(0, 10);
const failedJobs = await emailQueue.getFailed(0, 10);

// Pause/Resume queue
await emailQueue.pause();
await emailQueue.resume();

// Clean old jobs
await emailQueue.clean(3600000, 100, 'completed'); // 1 hour, 100 jobs
```

---

## Production Checklist

- [ ] Redis connection configured with connection pooling
- [ ] Job retry strategy configured (exponential backoff)
- [ ] Rate limiting set for API-dependent jobs
- [ ] Job retention policies configured (removeOnComplete/removeOnFail)
- [ ] Worker concurrency tuned for workload
- [ ] Monitoring and alerting for failed jobs
- [ ] Queue pause/resume capability
- [ ] Job progress tracking for long-running tasks
- [ ] Stalled job detection configured

---

## Team Conventions

### Job Naming
```typescript
// Use action-based naming
'send-welcome'     // ✓
'send-email'       // ✗ Too generic
'process-payment'  // ✓
'do-stuff'         // ✗ Too vague
```

### Job Data
```typescript
// Always include identifiers
{
  orderId: '123',
  userId: '456',
  email: 'user@example.com',
}
```

### Error Handling
```typescript
// Don't throw for expected failures
if (emailBounced) {
  return { status: 'bounced', email };
}

// Throw for unexpected failures
throw new Error('SMTP connection failed');
```
