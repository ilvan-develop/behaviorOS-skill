---
name: nodemailer
description: Enterprise Nodemailer 9.x email sending with SMTP, templates, attachments, queue integration, and deliverability. Use when implementing email notifications, transactional emails, or email templates.
metadata:
  stack: nodemailer-9
  scope: infrastructure
  version: "9.0"
---

# Nodemailer 9.x Enterprise Email Guide

## Overview

Nodemailer is a module for Node.js applications to allow easy as cake email sending. It supports SMTP, direct, and SES transport.

### When to Use Nodemailer
- Transactional emails (welcome, reset password)
- Email notifications
- Newsletter sending
- Email templates
- Bulk email campaigns

---

## Transporter Setup

```typescript
// src/lib/mailer.ts
import nodemailer from 'nodemailer';
import { Logger } from '@nestjs/common';

const logger = new Logger('Mailer');

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5,
  connectionTimeout: 10000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

// Verify connection on startup
export async function verifyTransport() {
  try {
    await transporter.verify();
    logger.log('SMTP connection verified');
  } catch (error) {
    logger.error('SMTP connection failed', error);
  }
}
```

---

## Send Email

```typescript
// Basic email
await transporter.sendMail({
  from: '"FinPay" <noreply@finpay.com>',
  to: 'user@example.com',
  subject: 'Welcome to FinPay',
  text: `Welcome ${name}! Your account has been created.`,
  html: `<h1>Welcome ${name}</h1><p>Your account has been created.</p>`,
});

// With attachments
await transporter.sendMail({
  from: '"FinPay" <noreply@finpay.com>',
  to: 'user@example.com',
  subject: 'Your Invoice',
  html: invoiceTemplate,
  attachments: [
    {
      filename: 'invoice.pdf',
      path: '/path/to/invoice.pdf',
      contentType: 'application/pdf',
    },
    {
      filename: 'logo.png',
      cid: 'logo',
      path: '/path/to/logo.png',
    },
  ],
});
```

---

## HTML Templates

```typescript
const welcomeTemplate = (name: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: sans-serif; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    .button { background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <img src="cid:logo" alt="FinPay" style="max-width: 150px;">
    <h1>Welcome, ${name}!</h1>
    <p>Your FinPay account is ready to use.</p>
    <a href="${process.env.APP_URL}/dashboard" class="button">Go to Dashboard</a>
    <p style="color: #666; font-size: 12px; margin-top: 20px;">
      If you didn't create this account, please ignore this email.
    </p>
  </div>
</body>
</html>
`;

// Usage
await transporter.sendMail({
  from: '"FinPay" <noreply@finpay.com>',
  to: user.email,
  subject: 'Welcome to FinPay',
  html: welcomeTemplate(user.name),
  attachments: [
    { filename: 'logo.png', cid: 'logo', path: '/path/to/logo.png' },
  ],
});
```

---

## Bulk Email with Queue

```typescript
async function sendBulkEmails(users: User[], template: (user: User) => string) {
  const results = await Promise.allSettled(
    users.map((user) =>
      transporter.sendMail({
        from: '"FinPay" <noreply@finpay.com>',
        to: user.email,
        subject: 'Monthly Report',
        html: template(user),
      })
    )
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.log(`Bulk email sent: ${successful} successful, ${failed} failed`);
  return { successful, failed };
}
```

---

## Anti-Patterns

### ❌ No Error Handling
```typescript
// BAD
await transporter.sendMail(mailOptions);
```

### ✅ Handle Errors
```typescript
// GOOD
try {
  await transporter.sendMail(mailOptions);
} catch (error) {
  logger.error('Failed to send email', error);
  throw error;
}
```

### ❌ Hardcoded Templates
```typescript
// BAD
html: `<h1>Welcome, ${user.name}!</h1>`
```

### ✅ Template Functions
```typescript
// GOOD
html: welcomeTemplate(user.name)
```

---

## Production Checklist

- [ ] SMTP credentials in environment variables
- [ ] Connection pooling enabled
- [ ] Rate limiting configured
- [ ] Error handling implemented
- [ ] HTML templates with responsive design
- [ ] Unsubscribe link included
- [ ] Email tested across clients (Gmail, Outlook, Apple Mail)
- [ ] SPF/DKIM/DMARC configured

---

## Team Conventions

### Template Structure
```typescript
// templates/welcome.ts
export const welcomeTemplate = (data) => `...`;

// templates/invoice.ts
export const invoiceTemplate = (data) => `...`;

// templates/index.ts
export { welcomeTemplate } from './welcome';
export { invoiceTemplate } from './invoice';
```
