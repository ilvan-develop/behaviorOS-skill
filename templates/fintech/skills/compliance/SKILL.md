---
name: compliance
description: Compliance with Angolan regulations (AGT, SAF-T), data protection (LGPD), and payment security (PCI-DSS). Use when implementing financial features, handling personal data, or building payment systems.
metadata:
  stack: compliance
  scope: backend
  version: "1.0"
---

# Compliance Enterprise Guide

## Overview

Compliance with regulatory requirements is critical for financial applications. This skill covers AGT (Angolan Tax Authority), SAF-T (Standard Audit File for Tax), LGPD (Lei Geral de Proteção de Dados), and PCI-DSS (Payment Card Industry Data Security Standard).

### When to Use Compliance
- Building payment processing systems
- Handling personal data
- Implementing financial reporting
- Creating audit trails
- Building tax calculation features

---

## AGT (Autoridade Geral Tributária)

### Overview
AGT is the Angolan tax authority. All financial transactions must comply with their regulations.

### Requirements
1. **Unique Transaction IDs**: Every transaction must have a unique identifier
2. **Timestamp**: Accurate timestamps for all operations
3. **Currency**: Support for AOA (Angolan Kwanza)
4. **Tax Calculation**: Proper tax calculation and reporting
5. **Audit Trail**: Complete audit trail for all financial operations

### Implementation

#### Transaction ID
```typescript
// ✅ Generate unique transaction ID
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `FP-${timestamp}-${random}`.toUpperCase();
}
```

#### Tax Calculation
```typescript
// ✅ Calculate AGT tax
function calculateAGTTax(amount: number): number {
  // AGT tax rate: 14% for most services
  const AGT_RATE = 0.14;
  return Math.round(amount * AGT_RATE * 100) / 100;
}
```

#### Audit Trail
```typescript
// ✅ Log financial operation
interface AuditEntry {
  transactionId: string;
  timestamp: Date;
  operation: string;
  amount: number;
  currency: string;
  userId: string;
  organizationId: string;
}

function logAuditEntry(entry: AuditEntry): void {
  // Append to audit log
  auditLog.append(entry);
}
```

---

## SAF-T (Standard Audit File for Tax)

### Overview
SAF-T is a standard format for exporting accounting data. Required for tax audits in Angola.

### Requirements
1. **Header**: Company information, tax registration
2. **Customers**: Customer master data
3. **Suppliers**: Supplier master data
4. **Products**: Product/service master data
5. **Invoices**: Sales invoices
6. **Payments**: Payment records
7. **Journal Entries**: Accounting journal entries

### Implementation

#### SAF-T Header
```typescript
// ✅ Generate SAF-T header
interface SAFTheader {
  company: {
    name: string;
    taxId: string;
    address: string;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
  currency: string;
  generatedAt: Date;
}

function generateSAFTheader(): SAFTheader {
  return {
    company: {
      name: process.env.COMPANY_NAME || '',
      taxId: process.env.TAX_ID || '',
      address: process.env.COMPANY_ADDRESS || '',
    },
    period: {
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
    currency: 'AOA',
    generatedAt: new Date(),
  };
}
```

#### SAF-T Invoice
```typescript
// ✅ Generate SAF-T invoice
interface SAFInvoice {
  invoiceNumber: string;
  invoiceDate: Date;
  customer: {
    name: string;
    taxId: string;
  };
  lines: Array<{
    product: string;
    quantity: number;
    unitPrice: number;
    tax: number;
    total: number;
  }>;
  total: number;
  tax: number;
}
```

---

## LGPD (Lei Geral de Proteção de Dados)

### Overview
LGPD is Brazil's data protection law, similar to GDPR. Applies to handling personal data in Angola.

### Requirements
1. **Consent**: Explicit consent for data collection
2. **Purpose**: Clear purpose for data processing
3. **Minimization**: Collect only necessary data
4. **Security**: Protect personal data
5. **Retention**: Define data retention periods
6. **Access**: Allow users to access their data
7. **Deletion**: Allow users to delete their data

### Implementation

#### Consent Management
```typescript
// ✅ Track consent
interface Consent {
  userId: string;
  purpose: string;
  grantedAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
}

async function grantConsent(userId: string, purpose: string): Promise<Consent> {
  return prisma.consent.create({
    data: {
      userId,
      purpose,
      grantedAt: new Date(),
    },
  });
}

async function revokeConsent(userId: string, purpose: string): Promise<void> {
  await prisma.consent.updateMany({
    where: { userId, purpose, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

#### Data Minimization
```typescript
// ✅ Collect only necessary data
interface UserData {
  id: string;
  name: string;
  email: string;
  // ❌ Don't collect unnecessary data
  // phone, address, etc. unless necessary
}
```

#### Right to Access
```typescript
// ✅ Allow users to access their data
async function getUserData(userId: string): Promise<UserData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      // Only select necessary fields
    },
  });
  return user;
}
```

#### Right to Deletion
```typescript
// ✅ Allow users to delete their data
async function deleteUserData(userId: string): Promise<void> {
  // Soft delete first
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
  
  // Then schedule hard delete
  await scheduleHardDelete(userId);
}
```

---

## PCI-DSS (Payment Card Industry Data Security Standard)

### Overview
PCI-DSS is a security standard for organizations that handle credit card data.

### Requirements
1. **No Card Data Storage**: Never store card numbers
2. **Tokenization**: Use tokens for card references
3. **Encryption**: Encrypt sensitive data in transit and at rest
4. **Access Control**: Limit access to card data
5. **Monitoring**: Monitor access to card data
6. **Testing**: Regular security testing
7. **Policy**: Maintain security policies

### Implementation

#### No Card Data Storage
```typescript
// ❌ NEVER store card data
interface Payment {
  id: string;
  // ❌ Don't store these
  // cardNumber: string;
  // cvv: string;
  // expiryDate: string;
  
  // ✅ Store reference only
  cardToken: string;
  lastFourDigits: string;
  cardBrand: string;
}
```

#### Tokenization
```typescript
// ✅ Use tokenization
async function tokenizeCard(cardData: CardData): Promise<CardToken> {
  // Send to payment processor
  const token = await paymentProcessor.tokenize(cardData);
  
  // Store only token
  return {
    token: token.id,
    lastFourDigits: cardData.number.slice(-4),
    cardBrand: detectCardBrand(cardData.number),
  };
}
```

#### Encryption
```typescript
// ✅ Encrypt sensitive data
import { encrypt, decrypt } from '@/lib/crypto';

interface EncryptedData {
  iv: string;
  data: string;
}

function encryptSensitiveData(data: string): EncryptedData {
  return encrypt(data, process.env.ENCRYPTION_KEY);
}

function decryptSensitiveData(encrypted: EncryptedData): string {
  return decrypt(encrypted, process.env.ENCRYPTION_KEY);
}
```

#### Access Control
```typescript
// ✅ Limit access to card data
@UseGuards(AuthGuard, RolesGuard)
@Roles('payment:read')
async getPayment(@OrgId() organizationId: string) {
  // Only authorized users can access
  return this.paymentService.getPayment(organizationId);
}
```

---

## Anti-Patterns

### ❌ Transações sem Audit Trail
```typescript
// ❌ No logging
async function processPayment(amount: number) {
  await this.paymentService.process(amount);
  // No audit trail
}
```

### ✅ Transações com Audit Trail
```typescript
// ✅ Complete audit trail
async function processPayment(amount: number, userId: string) {
  const transactionId = generateTransactionId();
  
  await this.auditService.log({
    transactionId,
    operation: 'PAYMENT_PROCESS',
    amount,
    userId,
    timestamp: new Date(),
  });
  
  await this.paymentService.process(amount);
}
```

### ❌ Campos Obrigatórios Faltando
```typescript
// ❌ Missing required fields
interface Payment {
  amount: number;
  // ❌ Missing: transactionId, timestamp, currency
}
```

### ✅ Campos Obrigatórios Completos
```typescript
// ✅ All required fields
interface Payment {
  transactionId: string;
  timestamp: Date;
  amount: number;
  currency: string;
  organizationId: string;
  userId: string;
}
```

### ❌ Formato de Data Incorreto
```typescript
// ❌ Wrong date format
const timestamp = new Date().toLocaleString(); // Localized string
```

### ✅ Formato ISO 8601
```typescript
// ✅ ISO 8601 format
const timestamp = new Date().toISOString(); // 2026-08-14T10:30:00.000Z
```

### ❌ Moeda Não Suportada
```typescript
// ❌ Wrong currency
const amount = 100; // Which currency?
```

### ✅ Moeda Especificada
```typescript
// ✅ Currency specified
const amount = 100;
const currency = 'AOA'; // Angolan Kwanza
```

### ❌ Dados Pessoais sem Criptografia
```typescript
// ❌ Plaintext personal data
await prisma.user.create({
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    // ❌ Storing sensitive data in plaintext
  },
});
```

### ✅ Dados Pessoais Criptografados
```typescript
// ✅ Encrypted personal data
await prisma.user.create({
  data: {
    name: encrypt('John Doe'),
    email: encrypt('john@example.com'),
  },
});
```

### ❌ Sem Consentimento
```typescript
// ❌ No consent tracking
await prisma.user.create({
  data: {
    email: 'user@example.com',
    // ❌ No consent recorded
  },
});
```

### ✅ Com Consentimento
```typescript
// ✅ Consent recorded
await prisma.user.create({
  data: {
    email: 'user@example.com',
    consents: {
      create: {
        purpose: 'marketing',
        grantedAt: new Date(),
      },
    },
  },
});
```

### ❌ Dados de Cartão em Logs
```typescript
// ❌ Logging card data
this.logger.log(`Payment: ${cardNumber}`);
```

### ✅ Dados de Cartão Redactados
```typescript
// ✅ Card data masked
this.logger.log(`Payment: ${maskCard(cardNumber)}`);
```

### ❌ Sem Tokenização
```typescript
// ❌ Storing card data
interface Payment {
  cardNumber: string;
  cvv: string;
  expiryDate: string;
}
```

### ✅ Com Tokenização
```typescript
// ✅ Using tokens
interface Payment {
  cardToken: string;
  lastFourDigits: string;
}
```

---

## Production Checklist

### AGT
- [ ] Unique transaction IDs
- [ ] Accurate timestamps
- [ ] AOA currency support
- [ ] Tax calculation
- [ ] Audit trail

### SAF-T
- [ ] Header generated
- [ ] Customer data exported
- [ ] Supplier data exported
- [ ] Product data exported
- [ ] Invoices exported
- [ ] Payments exported
- [ ] Journal entries exported

### LGPD
- [ ] Consent tracking
- [ ] Purpose limitation
- [ ] Data minimization
- [ ] Security measures
- [ ] Retention periods
- [ ] Access rights
- [ ] Deletion rights

### PCI-DSS
- [ ] No card data storage
- [ ] Tokenization implemented
- [ ] Encryption in transit
- [ ] Encryption at rest
- [ ] Access control
- [ ] Monitoring
- [ ] Security testing
- [ ] Policies documented

---

## Team Conventions

### Data Handling
- Always encrypt sensitive data
- Use tokens for card references
- Log all financial operations
- Track consent for personal data

### Auditing
- Generate unique transaction IDs
- Use ISO 8601 timestamps
- Specify currency for all amounts
- Maintain complete audit trails

### Security
- Never store card data
- Use HTTPS for all API calls
- Implement rate limiting
- Monitor suspicious activity
