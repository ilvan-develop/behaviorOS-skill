---
name: helmet
description: Enterprise Helmet 8.x security headers for Express/NestJS with CSP, HSTS, CORS, and content security policies. Use when configuring HTTP security headers, CSP policies, or hardening API security.
metadata:
  stack: helmet-8
  scope: security
  version: "8.0"
---

# Helmet 8.x Enterprise Security Headers Guide

## Overview

Helmet helps secure Express/NestJS apps by setting various HTTP headers. It's a collection of middleware that sets security-related headers.

### When to Use Helmet
- All production HTTP servers
- APIs exposed to the internet
- Applications handling sensitive data
- Compliance requirements (SOC2, GDPR)

---

## Complete Configuration

```typescript
// main.ts
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({
    // ============================================
    // Content Security Policy
    // ============================================
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", process.env.API_URL],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        childSrc: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },

    // ============================================
    // HSTS (HTTP Strict Transport Security)
    // ============================================
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },

    // ============================================
    // Referrer Policy
    // ============================================
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // ============================================
    // Cross-Origin Policies
    // ============================================
    crossOriginEmbedderPolicy: false, // Required for some CDNs
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
    crossOriginOpenerPolicy: {
      policy: 'same-origin',
    },

    // ============================================
    // Other Headers
    // ============================================
    hidePoweredBy: true,
    noSniff: true,
    xssFilter: true,
    frameguard: { action: 'deny' },
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },

    // ============================================
    // Content Type Options
    // ============================================
    // Already included in noSniff
  }));

  await app.listen(3000);
}
```

---

## CSP for Different Environments

```typescript
// Development (relaxed)
const cspDev = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", "ws://localhost:*"],
  },
};

// Production (strict)
const cspProd = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.finpay.com"],
    frameSrc: ["'none'"],
  },
};
```

---

## Anti-Patterns

### ❌ No Security Headers
```typescript
// BAD: Vulnerable to attacks
app.listen(3000);
```

### ✅ Helmet Configured
```typescript
// GOOD: Protected
app.use(helmet());
```

### ❌ Overly Permissive CSP
```typescript
// BAD: Allows anything
{ scriptSrc: ["*"] }
```

### ✅ Strict CSP
```typescript
// GOOD: Only trusted sources
{ scriptSrc: ["'self'", "https://cdn.trusted.com"] }
```

---

## Production Checklist

- [ ] Helmet enabled on all endpoints
- [ ] HSTS with preload enabled
- [ ] CSP directives configured
- [ ] Cross-origin policies set
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy configured
- [ ] Permissions-Policy set

---

## Team Conventions

### Header Testing
```bash
# Test security headers
curl -I https://api.finpay.com

# Should see:
# Content-Security-Policy: ...
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Referrer-Policy: strict-origin-when-cross-origin
```
