---
name: postcss
description: Enterprise PostCSS 8.x configuration with Tailwind CSS v4, autoprefixer, and custom plugins. Use when configuring CSS processing, PostCSS plugins, or Tailwind CSS integration.
metadata:
  stack: postcss-8
  scope: css
---

# PostCSS Enterprise Configuration

## Overview

PostCSS is a tool for transforming CSS with JavaScript plugins. It's used by Tailwind CSS, autoprefixer, and many other CSS tools.

**When to Use:**
- Tailwind CSS v4 integration
- CSS transformation pipelines
- Vendor prefixing with autoprefixer
- CSS nesting and modern syntax
- Custom CSS processing workflows

**When NOT to Use:**
- Simple CSS projects without processing
- Projects using only CSS-in-JS
- Legacy CSS workflows

## Architecture Patterns

### Project Structure
```
web/
├── postcss.config.mjs       # PostCSS configuration
├── src/
│   ├── styles/
│   │   ├── globals.css      # Global styles
│   │   ├── components.css   # Component styles
│   │   └── utilities.css    # Utility classes
│   └── components/
└── package.json
```

### Configuration File
```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
```

## Complete Configuration

### postcss.config.mjs (Production)

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production'
      ? {
          cssnano: {
            preset: [
              'default',
              {
                discardComments: {
                  removeAll: true,
                },
                normalizeUrl: true,
                minifyFontValues: true,
                minifyGradients: true,
              },
            ],
          },
        }
      : {}),
  },
};

export default config;
```

### postcss.config.js (Advanced)

```javascript
module.exports = {
  plugins: [
    require('@tailwindcss/postcss'),
    require('autoprefixer'),
    require('postcss-import'),
    require('postcss-nesting'),
    require('postcss-preset-env'),
    ...(process.env.NODE_ENV === 'production'
      ? [
          require('cssnano')({
            preset: [
              'default',
              {
                discardComments: { removeAll: true },
                normalizeUrl: true,
                minifyFontValues: true,
                minifyGradients: true,
              },
            ],
          }),
        ]
      : []),
  ],
};
```

### postcss.config.ts (TypeScript)

```typescript
import type { Config } from 'postcss-load-config';

const config: Config = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production'
      ? {
          cssnano: {
            preset: 'default',
          },
        }
      : {}),
  },
};

export default config;
```

## Security Hardening

### Safe CSS Processing
```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {
      // Only add necessary prefixes
      overrideBrowserslist: ['> 1%', 'last 2 versions'],
    },
    // Avoid custom plugins from untrusted sources
  },
};
```

### Content Security Policy Considerations
- PostCSS plugins can modify CSS output
- Review custom plugins before adding
- Test CSS output in staging environment

## Performance Optimization

### Fast Processing
```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {
      // Optimize for speed
      optimize: true,
    },
    autoprefixer: {
      // Only run when needed
      overrideBrowserslist: ['last 2 versions'],
    },
    // Only add cssnano in production
    ...(process.env.NODE_ENV === 'production'
      ? { cssnano: { preset: 'default' } }
      : {}),
  },
};
```

### Caching Strategies
```bash
# PostCSS has built-in caching
# First run: full processing
npx postcss src/styles/globals.css -o dist/styles.css

# Subsequent runs: incremental
npx postcss src/styles/globals.css -o dist/styles.css --no-map
```

### CSS Minification
```javascript
// Only minify in production
const isProd = process.env.NODE_ENV === 'production';

export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
    ...(isProd ? { cssnano: { preset: 'default' } } : {}),
  },
};
```

## Integration Patterns

### With Tailwind CSS v4
```javascript
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
};
```

### With Vite
```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        require('@tailwindcss/postcss'),
        require('autoprefixer'),
      ],
    },
  },
});
```

### With Webpack
```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  require('@tailwindcss/postcss'),
                  require('autoprefixer'),
                ],
              },
            },
          },
        ],
      },
    ],
  },
};
```

### package.json Scripts
```json
{
  "scripts": {
    "build:css": "postcss src/styles/globals.css -o dist/styles.css",
    "build:css:watch": "postcss src/styles/globals.css -o dist/styles.css --watch",
    "build:css:prod": "NODE_ENV=production postcss src/styles/globals.css -o dist/styles.css"
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
    - run: npm run build:css:prod
    - run: npm run build
```

## Anti-Patterns

### ❌ DON'T
- Use old `tailwindcss` plugin: Use `@tailwindcss/postcss` for v4
- Skip minification in production: Always minify CSS
- Use `.js` extension: Use `.mjs` for ESM config
- Ignore CSS errors: Always check CSS output
- Mix PostCSS with other CSS tools: Choose one pipeline

### ✅ DO
- Use `@tailwindcss/postcss` for Tailwind v4
- Enable `cssnano` in production
- Use `.mjs` extension for ESM config
- Test CSS output in CI/CD
- Monitor CSS bundle size
- Use autoprefixer for vendor prefixes

## Troubleshooting

### Common Issues

**Tailwind CSS Not Working**
```javascript
// Ensure correct plugin
export default {
  plugins: {
    '@tailwindcss/postcss': {}, // Not 'tailwindcss'
    autoprefixer: {},
  },
};
```

**CSS Not Processing**
```bash
# Check PostCSS version
npx postcss --version

# Test with explicit config
npx postcss src/styles/globals.css -o dist/styles.css --config postcss.config.mjs
```

**Performance Issues**
```javascript
// Only add cssnano in production
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production'
      ? { cssnano: { preset: 'default' } }
      : {}),
  },
};
```

## Observability

### CSS Metrics
```bash
# Check CSS output
npx postcss src/styles/globals.css -o dist/styles.css --verbose

# Generate source maps
npx postcss src/styles/globals.css -o dist/styles.css --map
```

### Metrics to Track
- CSS processing time
- CSS bundle size
- Vendor prefix count
- Minification ratio

## Production Checklist

- [ ] PostCSS config uses correct plugins
- [ ] Tailwind CSS v4 plugin configured
- [ ] Autoprefixer configured
- [ ] cssnano enabled in production
- [ ] CSS processing runs in CI/CD
- [ ] CSS output tested
- [ ] Bundle size monitored
- [ ] Source maps configured

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
    - run: npm run build:css:prod
    - run: npm run build
    - name: Check CSS size
      run: du -sh dist/styles.css
```

### GitLab CI
```yaml
build:
  stage: build
  script:
    - npm ci
    - npm run build:css:prod
    - npm run build
  artifacts:
    paths:
      - dist/
```

## Team Conventions

- **Configuration Location**: Root `postcss.config.mjs`
- **Plugin Order**: Tailwind first, then autoprefixer
- **Minification**: Only in production
- **Testing**: Test CSS output in CI/CD
- **Documentation**: Keep PostCSS config updated
- **Monitoring**: Track CSS bundle size
