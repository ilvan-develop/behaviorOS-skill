---
name: axe-core
description: Enterprise axe-core 4.x accessibility testing with Playwright, React Testing Library, and automated WCAG compliance. Use when testing accessibility, auditing UI compliance, or fixing a11y issues.
metadata:
  stack: axe-core-4
  scope: accessibility
  version: "4.13"
---

# axe-core 4.x Enterprise Accessibility Testing Guide

## Overview

axe-core is an accessibility testing engine for websites and other HTML-based user interfaces. It's fast, returns zero false positives, and integrates with testing frameworks.

### When to Use axe-core
- Automated accessibility testing in CI/CD
- WCAG 2.1 compliance verification
- Component-level accessibility audits
- Regression testing for a11y

---

## Playwright Integration

```typescript
// e2e/accessibility/homepage.a11y.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('homepage has no accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('dashboard has no accessibility violations', async ({ page }) => {
  await page.goto('/dashboard');

  const results = await new AxeBuilder({ page })
    .include('#main-content')
    .exclude('#sidebar')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('login form has no accessibility violations', async ({ page }) => {
  await page.goto('/login');

  const results = await new AxeBuilder({ page })
    .include('form')
    .withRules(['color-contrast', 'label', 'aria-required-attr'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

---

## React Testing Library Integration

```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

it('form has no accessibility violations', async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container, {
    rules: {
      'color-contrast': { enabled: true },
      label: { enabled: true },
    },
  });
  expect(results).toHaveNoViolations();
});
```

---

## Custom Rules

```typescript
const results = await new AxeBuilder({ page })
  .include('#main-content')
  .exclude('#sidebar')
  .withTags(['wcag2a', 'wcag2aa'])
  .withRules(['color-contrast', 'image-alt', 'label'])
  .analyze();
```

---

## Common Issues and Fixes

### Missing Alt Text
```html
<!-- BAD -->
<img src="logo.png" />

<!-- GOOD -->
<img src="logo.png" alt="FinPay Logo" />
```

### Missing Label
```html
<!-- BAD -->
<input type="email" />

<!-- GOOD -->
<label for="email">Email</label>
<input id="email" type="email" />
```

### Low Color Contrast
```css
/* BAD: Contrast ratio < 4.5:1 */
.text { color: #999999; background: #ffffff; }

/* GOOD: Contrast ratio >= 4.5:1 */
.text { color: #595959; background: #ffffff; }
```

---

## CI/CD Integration

```yaml
# .github/workflows/a11y.yml
name: Accessibility Tests
on:
  pull_request:
    paths: ['src/components/**']

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: npm run test:a11y
```

---

## Production Checklist

- [ ] axe-core integrated in test suite
- [ ] WCAG 2.1 AA compliance verified
- [ ] Color contrast tested
- [ ] Form labels verified
- [ ] Image alt text present
- [ ] Keyboard navigation tested
- [ ] Screen reader tested
- [ ] Focus management verified

---

## Team Conventions

### Testing Scope
```typescript
// Test entire page
new AxeBuilder({ page }).analyze();

// Test specific component
new AxeBuilder({ page }).include('#my-component').analyze();

// Test specific rules
new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
```

### WCAG Tags
```typescript
// Minimum: WCAG 2.1 AA
.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])

// Strict: WCAG 2.1 AAA
.withTags(['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'])
```
