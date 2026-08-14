---
name: vite
description: Enterprise Vite 8.x configuration for React, Next.js, libraries with plugins, proxy, build optimization, environment variables, and development server. Use when configuring Vite, setting up projects, or optimizing builds.
metadata:
  stack: vite-8
  scope: build
---

# Vite Enterprise Configuration

## Overview

Vite is a fast frontend build tool that provides instant server start, lightning-fast HMR, and optimized builds. It's the default for Vue, React, and many other frameworks.

**When to Use:**
- React/Vue/Svelte development
- Library development with fast builds
- Projects needing instant server start
- Modern frontend applications
- Development with HMR (Hot Module Replacement)

**When NOT to Use:**
- Legacy browser support required (use webpack)
- Complex build pipelines with many plugins
- Backend API development (use NestJS)

## Architecture Patterns

### Project Structure
```
web/
├── vite.config.ts          # Vite configuration
├── src/
│   ├── main.tsx           # Entry point
│   ├── App.tsx            # Main component
│   ├── test/
│   │   └── setup.ts       # Test setup
│   └── index.css          # Global styles
├── public/                # Static assets
├── index.html             # HTML template
└── package.json
```

## Complete Configuration

### vite.config.ts (React + Tailwind)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
    cors: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          query: ['@tanstack/react-query'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
    target: 'es2022',
    minify: 'terser',
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/', 'dist/'],
  },
  css: {
    devSourcemap: true,
  },
  json: {
    namedExports: true,
    stringify: true,
  },
}));
```

### vite.config.ts (Library Mode)

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
  },
});
```

### vite.config.ts (SSR)

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        client: './index.html',
        server: './src/entry-server.tsx',
      },
    },
  },
  ssr: {
    noExternal: ['@tanstack/react-query'],
    external: ['react', 'react-dom'],
  },
});
```

## Environment Variables

### Environment Files
```bash
# .env (default)
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_APP_NAME=FinPay

# .env.development
VITE_API_URL=http://localhost:3001
VITE_DEBUG=true

# .env.production
VITE_API_URL=https://api.finpay.com
VITE_DEBUG=false

# .env.local (never commit)
VITE_SECRET_KEY=your-secret-key
```

### Accessing Variables
```typescript
// In code
const apiUrl = import.meta.env.VITE_API_URL;
const isDebug = import.meta.env.VITE_DEBUG === 'true';

// Type-safe access
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_DEBUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## Multi-Environment Builds

```typescript
export default defineConfig({
  builder: {
    buildApp: async (builder) => {
      const environments = Object.values(builder.environments);
      await Promise.all(environments.map((env) => builder.build(env)));
    },
    environments: {
      client: {
        build: {
          outDir: 'dist/client',
        },
      },
      server: {
        build: {
          outDir: 'dist/server',
        },
      },
    },
  },
});
```

## Security Hardening

### Secure Configuration
```typescript
export default defineConfig({
  server: {
    // Disable in production
    cors: process.env.NODE_ENV === 'development',
    
    // Use HTTPS in production
    https: process.env.NODE_ENV === 'production',
    
    // Restrict access
    host: process.env.NODE_ENV === 'development' ? true : '0.0.0.0',
  },
  build: {
    // Disable sourcemaps in production
    sourcemap: process.env.NODE_ENV !== 'production',
  },
});
```

### Content Security Policy
```typescript
export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
    },
  },
});
```

## Performance Optimization

### Fast Development
```typescript
export default defineConfig({
  server: {
    // Enable HMR
    hmr: true,
    
    // Watch files
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
  optimizeDeps: {
    // Pre-bundle dependencies
    include: ['react', 'react-dom', '@tanstack/react-query'],
    
    // Exclude from optimization
    exclude: ['your-local-package'],
  },
});
```

### Production Optimization
```typescript
export default defineConfig({
  build: {
    // Enable compression
    reportCompressedSize: true,
    
    // Chunk size warning
    chunkSizeWarningLimit: 1000,
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Minification
    minify: 'terser',
    
    // Target modern browsers
    target: 'es2022',
  },
  esbuild: {
    // Remove console in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
```

## Integration Patterns

### package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### With Tailwind CSS v4
```typescript
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
});
```

### With Sentry
```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
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
    - run: npm test
```

## Anti-Patterns

### ❌ DON'T
- Use `process.env` for client variables: Use `import.meta.env`
- Enable sourcemaps in production: Disable for security
- Skip type checking: Always run `tsc --noEmit`
- Use `require()`: Use ES modules
- Ignore bundle analysis: Monitor bundle size

### ✅ DO
- Use `VITE_` prefix for client variables
- Enable sourcemaps in development
- Use `manualChunks` for code splitting
- Use `terser` minification in production
- Test builds in CI/CD
- Monitor bundle size

## Troubleshooting

### Common Issues

**HMR Not Working**
```typescript
export default defineConfig({
  server: {
    hmr: true,
    watch: {
      usePolling: true, // For WSL/Docker
    },
  },
});
```

**Build Errors**
```bash
# Check TypeScript
npx tsc --noEmit

# Clear cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

**Performance Issues**
```typescript
export default defineConfig({
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
```

## Observability

### Build Metrics
```typescript
export default defineConfig({
  build: {
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
  },
});
```

### Metrics to Track
- Build time
- Bundle size
- Chunk sizes
- Compression ratio

## Production Checklist

- [ ] `vite.config.ts` configured properly
- [ ] Environment variables prefixed with `VITE_`
- [ ] Sourcemaps disabled in production
- [ ] Code splitting configured
- [ ] Bundle size monitored
- [ ] Type checking runs separately
- [ ] CI/CD pipeline includes build
- [ ] Tests run before build
- [ ] Performance optimized

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
    - name: Check bundle size
      run: |
        npm run build
        du -sh dist/
```

### GitLab CI
```yaml
build:
  stage: build
  script:
    - npm ci
    - npm run typecheck
    - npm run build
    - npm test
  artifacts:
    paths:
      - dist/
```

## Team Conventions

- **Configuration Location**: Root `vite.config.ts`
- **Environment Variables**: Use `VITE_` prefix
- **Sourcemaps**: Enable in development, disable in production
- **Code Splitting**: Use `manualChunks` for vendor code
- **Type Checking**: Run `tsc --noEmit` separately
- **Testing**: Use Vitest with Vite
- **Documentation**: Keep vite.config.ts updated
