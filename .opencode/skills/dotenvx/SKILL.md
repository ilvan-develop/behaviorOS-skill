---
name: dotenvx
description: Enterprise dotenvx 1.x environment variable management with encryption, multi-environment support, and key rotation. Use when managing .env files, encrypting secrets, or configuring environment variables across environments.
metadata:
  stack: dotenvx-1
  scope: config
---

# dotenvx Enterprise Environment Management

## Overview

dotenvx is a next-generation environment variable manager with encryption, multi-environment support, and key rotation. It's a drop-in replacement for dotenv with enhanced security features.

**When to Use:**
- Managing environment variables across environments
- Encrypting secrets for version control
- Multi-environment deployments (dev, staging, prod)
- CI/CD pipelines with encrypted secrets
- Team collaboration with shared .env files

**When NOT to Use:**
- Simple projects with few environment variables
- Projects without encryption requirements
- Single-environment deployments

## Architecture Patterns

### Project Structure
```
project/
├── .env                    # Default environment
├── .env.development        # Development environment
├── .env.staging            # Staging environment
├── .env.production         # Production environment
├── .env.keys               # Encryption keys (never commit)
├── .env.example            # Documentation
└── package.json
```

## Complete Configuration

### Setup

```bash
# Install
npm install @dotenvx/dotenvx --save-dev

# Initialize
npx dotenvx init

# This creates:
# - .env
# - .env.keys
# - .env.example
```

### .env Files

```bash
# .env (default)
DATABASE_URL=postgresql://localhost:5432/finpay
REDIS_URL=redis://localhost:6379
APP_PORT=3000
APP_NAME=FinPay
LOG_LEVEL=info

# .env.development
DATABASE_URL=postgresql://localhost:5432/finpay_dev
NODE_ENV=development
DEBUG=true
API_URL=http://localhost:3001

# .env.staging
DATABASE_URL=postgresql://staging-db:5432/finpay_staging
NODE_ENV=staging
DEBUG=false
API_URL=https://staging-api.finpay.com

# .env.production
DATABASE_URL=postgresql://prod-db:5432/finpay
NODE_ENV=production
DEBUG=false
API_URL=https://api.finpay.com
```

### Encryption

```bash
# Encrypt a specific key
npx dotenvx set DATABASE_URL "postgresql://prod-db:5432/finpay" --encrypt

# Encrypt entire .env file
npx dotenvx encrypt

# Decrypt
npx dotenvx decrypt

# Run with decrypted env
npx dotenvx run -- node dist/main.js

# Set with encryption
npx dotenvx set API_KEY "your-secret-api-key" --encrypt
```

### .env.keys (Secret Key)

```bash
# .env.keys (never commit this file)
# This file contains the encryption keys
# Keep it secret and secure

# Default key
DOTENV_KEY="<your-key>"

# Environment-specific keys
DOTENV_KEY_DEVELOPMENT="<dev-key>"
DOTENV_KEY_STAGING="<staging-key>"
DOTENV_KEY_PRODUCTION="<prod-key>"
```

### Multi-Environment

```bash
# Run with specific environment
npx dotenvx run -e development -- npm run dev
npx dotenvx run -e staging -- npm run build
npx dotenvx run -e production -- node dist/main.js

# Run with multiple environments
npx dotenvx run -e .env,.env.production -- node dist/main.js
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "dotenvx run -e development -- npm run dev:raw",
    "dev:raw": "next dev",
    "build": "dotenvx run -e production -- npm run build:raw",
    "build:raw": "next build",
    "start": "dotenvx run -e production -- node dist/main.js",
    "test": "dotenvx run -e test -- vitest run",
    "lint": "biome check ."
  }
}
```

## Security Hardening

### Encryption Best Practices

```bash
# 1. Never commit .env.keys
echo ".env.keys" >> .gitignore

# 2. Use different keys for different environments
npx dotenvx set API_KEY_DEV "dev-key" --encrypt
npx dotenvx set API_KEY_PROD "prod-key" --encrypt

# 3. Rotate keys periodically
# Generate new key
npx dotenvx keygen

# Re-encrypt with new key
npx dotenvx encrypt

# 4. Use environment-specific keys
DOTENV_KEY_DEVELOPMENT="<new-dev-key>"
DOTENV_KEY_PRODUCTION="<new-prod-key>"
```

### CI/CD Security

```yaml
# GitHub Actions
- name: Run with env
  run: npx dotenvx run -- npm test
  env:
    DOTENV_KEY: ${{ secrets.DOTENV_KEY }}

# Or use environment-specific keys
- name: Run with production env
  run: npx dotenvx run -e production -- npm run build
  env:
    DOTENV_KEY_PRODUCTION: ${{ secrets.DOTENV_KEY_PRODUCTION }}
```

### Key Management

```bash
# Generate new key
npx dotenvx keygen

# List keys
npx dotenvx keys

# Rotate key
npx dotenvx keygen --rotate

# Backup keys
cp .env.keys .env.keys.backup
```

## Performance Optimization

### Fast Loading

```typescript
// Use dotenvx for fast loading
import 'dotenvx/config';

// Access variables
const dbUrl = process.env.DATABASE_URL;
```

### Caching Strategies

```bash
# Cache decrypted values
npx dotenvx run --cache -- node dist/main.js

# Clear cache
npx dotenvx cache clear
```

## Integration Patterns

### NestJS Integration

```typescript
// src/main.ts
import 'dotenvx/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
```

### Next.js Integration

```javascript
// next.config.js
require('dotenvx').config();

module.exports = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
};
```

### Docker Integration

```dockerfile
# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx dotenvx encrypt
CMD ["npx", "dotenvx", "run", "-e", "production", "--", "node", "dist/main.js"]
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
- name: Setup environment
  run: npx dotenvx run -e ${{ matrix.environment }} -- npm run build
  env:
    DOTENV_KEY: ${{ secrets.DOTENV_KEY }}
```

## Anti-Patterns

### ❌ DON'T
- Commit `.env.keys`: Always gitignore
- Use weak encryption keys: Use strong keys
- Share production keys: Use different keys per environment
- Skip key rotation: Rotate periodically
- Use default keys in production: Use unique keys

### ✅ DO
- Use `.env.example` for documentation
- Encrypt all production secrets
- Use environment-specific keys
- Rotate keys periodically
- Backup keys securely
- Test with decrypted env in CI/CD

## Troubleshooting

### Common Issues

**Keys Not Working**
```bash
# Check key format
npx dotenvx keys

# Regenerate key
npx dotenvx keygen

# Re-encrypt
npx dotenvx encrypt
```

**Variables Not Loading**
```bash
# Check environment
npx dotenvx run -e development -- env | grep DATABASE_URL

# Debug loading
DEBUG=dotenvx npx dotenvx run -- node script.js
```

**CI/CD Issues**
```yaml
# Ensure DOTENV_KEY is set
- name: Run with env
  run: npx dotenvx run -- npm test
  env:
    DOTENV_KEY: ${{ secrets.DOTENV_KEY }}
```

## Observability

### Debug Loading

```bash
# Debug mode
DEBUG=dotenvx npx dotenvx run -- node script.js

# Verbose output
npx dotenvx run --verbose -- node script.js

# Check loaded variables
npx dotenvx run -- node -e "console.log(process.env)"
```

### Metrics to Track
- Environment variable loading time
- Encryption/decryption operations
- Key rotation frequency
- CI/CD pipeline performance

## Production Checklist

- [ ] `.env.keys` gitignored
- [ ] Encryption keys secured
- [ ] Environment-specific keys configured
- [ ] Key rotation scheduled
- [ ] CI/CD pipeline uses dotenvx
- [ ] Docker images use dotenvx
- [ ] Documentation updated
- [ ] Backup keys stored securely
- [ ] Monitoring configured

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
    - run: npx dotenvx run -e production -- npm run build
      env:
        DOTENV_KEY: ${{ secrets.DOTENV_KEY }}
```

### GitLab CI
```yaml
build:
  stage: build
  script:
    - npm ci
    - npx dotenvx run -e production -- npm run build
  variables:
    DOTENV_KEY: $DOTENV_KEY
```

## Team Conventions

- **Configuration Location**: Root `.env` files
- **Encryption**: Always encrypt production secrets
- **Key Management**: Use environment-specific keys
- **Documentation**: Keep `.env.example` updated
- **Security**: Never commit `.env.keys`
- **Testing**: Test with decrypted env in CI/CD
- **Rotation**: Rotate keys quarterly
