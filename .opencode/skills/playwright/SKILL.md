---
name: playwright
description: Enterprise Playwright 1.61+ E2E testing with fixtures, page objects, authentication, visual testing, accessibility testing, and CI configuration. Use when writing end-to-end tests, visual regression tests, or setting up browser automation.
metadata:
  stack: playwright-1
  scope: testing
  version: "1.61"
---

# Playwright Enterprise E2E Testing Guide

## Overview

Playwright is a framework for Web Testing and Automation that enables cross-browser testing of Chromium, Firefox, and WebKit with a single API.

### When to Use Playwright
- End-to-end testing of web applications
- Cross-browser compatibility testing
- Visual regression testing
- Accessibility testing
- Mobile device emulation

---

## Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30000,
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
    toMatchSnapshot: {
      maxDiffPixels: 100,
    },
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    geolocation: { longitude: -74.006, latitude: 40.7128 },
    permissions: ['geolocation'],
  },
  projects: [
    // Authentication setup
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Desktop browsers
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Mobile
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 13'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  outputDir: 'test-results/',
});
```

---

## Authentication Setup

```typescript
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login
  await page.goto('/login');

  // Fill login form
  await page.fill('[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
  await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD || 'password123');

  // Submit and wait for redirect
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');

  // Verify login
  await expect(page.locator('h1')).toHaveText('Dashboard');

  // Save auth state
  await page.context().storageState({ path: authFile });
});
```

---

## Page Object Pattern

```typescript
// e2e/pages/login.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('[name="email"]');
    this.passwordInput = page.locator('[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.forgotPasswordLink = page.locator('a', { hasText: 'Forgot password?' });
  }

  async goto() {
    await this.page.goto('/login');
    await this.waitForReady();
  }

  async waitForReady() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL('/dashboard');
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }
}

// e2e/pages/dashboard.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly userMenu: Locator;
  readonly transactionsTable: Locator;
  readonly newTransactionButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.transactionsTable = page.locator('[data-testid="transactions-table"]');
    this.newTransactionButton = page.locator('button', { hasText: 'New Transaction' });
  }

  async expectReady() {
    await expect(this.heading).toHaveText('Dashboard');
    await expect(this.transactionsTable).toBeVisible();
  }

  async createTransaction(data: { amount: string; description: string }) {
    await this.newTransactionButton.click();
    await this.page.fill('[name="amount"]', data.amount);
    await this.page.fill('[name="description"]', data.description);
    await this.page.click('button', { hasText: 'Submit' });
  }
}
```

---

## Test Examples

### Basic Flow
```typescript
// e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('shows login form', async () => {
    await loginPage.expectReady();
  });

  test('shows error for invalid credentials', async () => {
    await loginPage.login('wrong@example.com', 'wrongpassword');
    await loginPage.expectError('Invalid credentials');
  });

  test('redirects to dashboard on success', async ({ page }) => {
    await loginPage.login('test@example.com', 'password123');
    await expect(page).toHaveURL('/dashboard');
  });
});
```

### API Testing
```typescript
// e2e/api/users.api.ts
import { test, expect } from '@playwright/test';

test.describe('Users API', () => {
  test('GET /api/v1/users returns users', async ({ request }) => {
    const response = await request.get('/api/v1/users');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBeTruthy();
  });

  test('POST /api/v1/users creates user', async ({ request }) => {
    const response = await request.post('/api/v1/users', {
      data: {
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
      },
    });

    expect(response.status()).toBe(201);
    const user = await response.json();
    expect(user.id).toBeDefined();
  });
});
```

### Visual Testing
```typescript
// e2e/visual/homepage.spec.ts
import { test, expect } from '@playwright/test';

test('homepage matches screenshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png', {
    maxDiffPixels: 100,
    animations: 'disabled',
  });
});

test('dark mode matches screenshot', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page).toHaveScreenshot('homepage-dark.png');
});
```

### Accessibility Testing
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
```

---

## Commands

```bash
# Run all tests
npx playwright test

# Run specific file
npx playwright test e2e/auth/login.spec.ts

# Run in UI mode
npx playwright test --ui

# Run with headed browser
npx playwright test --headed

# Run specific project
npx playwright test --project=chromium

# Show report
npx playwright show-report

# Codegen (record tests)
npx playwright codegen http://localhost:3000

# Update snapshots
npx playwright test --update-snapshots

# Debug tests
npx playwright test --debug
```

---

## Anti-Patterns

### ❌ Hardcoded Waits
```typescript
// BAD
await page.waitForTimeout(5000);
await page.click('button');
```

### ✅ Smart Waits
```typescript
// GOOD
await page.waitForSelector('button:not([disabled])');
await page.click('button');

// Or better
await expect(page.getByRole('button')).toBeEnabled();
await page.getByRole('button').click();
```

### ❌ Testing Without Isolation
```typescript
// BAD: Tests depend on each other
test('create user', async () => { ... });
test('update user', async () => { ... }); // Depends on create
```

### ✅ Independent Tests
```typescript
// GOOD: Each test is independent
test('create user', async ({ page }) => {
  // Setup, action, assertion
});

test('update user', async ({ page }) => {
  // Setup (create fresh user), action, assertion
});
```

---

## CI/CD Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on:
  push:
    branches: [main]
  pull_request:

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps

      - name: Run E2E Tests
        run: pnpm exec playwright test
        env:
          BASE_URL: http://localhost:3000
          TEST_USER_EMAIL: test@example.com
          TEST_USER_PASSWORD: password123

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Team Conventions

### File Structure
```
e2e/
├── auth.setup.ts           # Auth setup
├── pages/                  # Page objects
│   ├── login.page.ts
│   └── dashboard.page.ts
├── auth/                   # Auth tests
│   └── login.spec.ts
├── dashboard/              # Dashboard tests
│   └── overview.spec.ts
├── api/                    # API tests
│   └── users.api.ts
├── visual/                 # Visual tests
│   └── homepage.spec.ts
└── a11y/                   # Accessibility tests
    └── homepage.a11y.ts
```

### Naming Convention
- `*.spec.ts` for functional tests
- `*.api.ts` for API tests
- `*.a11y.ts` for accessibility tests
- `*.visual.ts` for visual regression tests

### Test Data
- Use unique data per test (e.g., `test-${Date.now()}@example.com`)
- Clean up test data in `afterAll`
- Use fixtures for reusable test data
