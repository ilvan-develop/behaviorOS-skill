---
name: ioredis
description: Enterprise ioredis 5.x Redis client with clustering, pipelines, pub/sub, caching patterns, and connection management. Use when connecting to Redis, implementing caching, or setting up pub/sub.
metadata:
  stack: ioredis-5
  scope: infrastructure
  version: "5.11"
---

# ioredis 5.x Enterprise Redis Client Guide

## Overview

ioredis is a robust, performance-focused Redis client for Node.js with support for clustering, sentinels, streams, pub/sub, and Lua scripting.

### When to Use ioredis
- Caching (session storage, API responses)
- Rate limiting (distributed counters)
- Pub/Sub messaging
- Job queue backend (BullMQ)
- Session management
- Distributed locks

---

## Connection Setup

```typescript
// src/config/redis.ts
import Redis from 'ioredis';

const connectionConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 0,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
  keepAlive: 30000,
  connectTimeout: 10000,
  enableReadyCheck: true,
  autoResubscribe: true,
  autoResendUnfulfilledCommands: true,
  enableOfflineQueue: true,
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    return targetErrors.some((e) => err.message.includes(e));
  },
};

// Main client
export const redis = new Redis(connectionConfig);

// Duplicate for pub/sub
export const redisSubscriber = redis.duplicate();
export const redisPublisher = redis.duplicate();

// Event handlers
redis.on('connect', () => console.log('Redis connected'));
redis.on('ready', () => console.log('Redis ready'));
redis.on('error', (err) => console.error('Redis error:', err));
redis.on('close', () => console.log('Redis connection closed'));
redis.on('reconnecting', (delay) => console.log(`Redis reconnecting in ${delay}ms`));
```

---

## Basic Operations

```typescript
// Strings
await redis.set('user:1', JSON.stringify(user), 'EX', 3600); // TTL 1 hour
const user = JSON.parse(await redis.get('user:1'));
await redis.setex('session:abc', 1800, 'active'); // TTL 30 min

// Hashes
await redis.hset('user:1', { name: 'John', email: 'john@example.com' });
const name = await redis.hget('user:1', 'name');
const allFields = await redis.hgetall('user:1');

// Lists
await redis.lpush('queue:emails', JSON.stringify(email));
const email = await redis.rpop('queue:emails');
const length = await redis.llen('queue:emails');

// Sets
await redis.sadd('online:users', userId);
const isOnline = await redis.sismember('online:users', userId);
const allOnline = await redis.smembers('online:users');

// Sorted Sets
await redis.zadd('leaderboard', score, userId);
const top10 = await redis.zrevrange('leaderboard', 0, 9, 'WITHSCORES');

// Streams
await redis.xadd('orders', '*', 'orderId', '123', 'amount', '100');
const messages = await redis.xrange('orders', '-', '+', 'COUNT', 10);
```

---

## Caching Patterns

```typescript
// Cache-aside pattern
async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl = 3600): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await fetcher();
  await redis.set(key, JSON.stringify(data), 'EX', ttl);
  return data;
}

// Usage
const users = await getCached(
  'users:all',
  () => prisma.user.findMany(),
  300 // 5 minutes
);

// Cache invalidation
async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Usage
await invalidateCache('users:*');
```

---

## Pipelines

```typescript
// Batch operations
const pipeline = redis.pipeline();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.get('key1');
pipeline.get('key2');
const results = await pipeline.exec();
// results = [[null, 'OK'], [null, 'OK'], [null, 'value1'], [null, 'value2']]

// Transaction
const multi = redis.multi();
multi.set('counter', 0);
multi.incr('counter');
multi.get('counter');
const results = await multi.exec();
```

---

## Pub/Sub

```typescript
// Publisher
async function publishNotification(channel: string, data: any) {
  await redisPublisher.publish(channel, JSON.stringify(data));
}

// Subscriber
await redisSubscriber.subscribe('notifications', 'alerts');
redisSubscriber.on('message', (channel, message) => {
  console.log(`Received on ${channel}:`, JSON.parse(message));
});

// Pattern subscription
await redisSubscriber.psubscribe('user:*');
redisSubscriber.on('pmessage', (pattern, channel, message) => {
  console.log(`Pattern ${pattern} matched ${channel}`);
});
```

---

## Distributed Locks

```typescript
// Redlock pattern
async function acquireLock(key: string, ttl = 10000): Promise<string | null> {
  const token = crypto.randomUUID();
  const acquired = await redis.set(`lock:${key}`, token, 'NX', 'PX', ttl);
  return acquired ? token : null;
}

async function releaseLock(key: string, token: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  const result = await redis.eval(script, 1, `lock:${key}`, token);
  return result === 1;
}

// Usage
const lock = await acquireLock('order:123');
if (lock) {
  try {
    await processOrder('123');
  } finally {
    await releaseLock('order:123', lock);
  }
}
```

---

## Cluster

```typescript
const cluster = new Redis.Cluster(
  [
    { host: 'node1', port: 6379 },
    { host: 'node2', port: 6379 },
    { host: 'node3', port: 6379 },
  ],
  {
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
    },
    scaleReads: 'slave',
    clusterRetryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
  }
);
```

---

## Anti-Patterns

### ❌ Blocking Operations
```typescript
// BAD: Blocks entire event loop
const keys = await redis.keys('user:*'); // O(N) operation
```

### ✅ Use SCAN
```typescript
// GOOD: Non-blocking iteration
const stream = redis.scanStream({ match: 'user:*', count: 100 });
stream.on('data', (keys) => {
  // Process keys in batches
});
```

### ❌ No TTL on Cache
```typescript
// BAD: Cache grows forever
await redis.set('user:1', JSON.stringify(user));
```

### ✅ Always Set TTL
```typescript
// GOOD: TTL prevents memory issues
await redis.set('user:1', JSON.stringify(user), 'EX', 3600);
```

---

## Production Checklist

- [ ] Connection pooling configured
- [ ] Retry strategy implemented
- [ ] Lazy connect enabled
- [ ] TTL set on all cached data
- [ ] Pub/Sub connections duplicated
- [ ] Error handling for connection loss
- [ ] Memory limits monitored
- [ ] Slow log enabled

---

## Team Conventions

### Key Naming
```typescript
// Prefix with entity
'user:123'           // User data
'session:abc'        // Session
'cache:users:all'    // Cached query
'lock:order:123'     // Distributed lock
'rate:api:user:123'  // Rate limit counter
```

### TTL Guidelines
```typescript
3600    // 1 hour (user data)
1800    // 30 min (sessions)
300     // 5 min (API cache)
86400   // 24 hours (long-lived data)
```
