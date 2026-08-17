---
name: fintech-domain
description: Fintech domain knowledge for Angolan payment processing. Use when implementing payment concepts, money movement, financial transactions, or domain-specific logic for fintech applications.
metadata:
  scope: domain
  domain: fintech
  version: "1.0"
---

# Fintech Domain Knowledge — FinPay v2

## Overview

Domain knowledge for Angolan fintech applications covering payment processing, money movement, financial transactions, and regulatory requirements.

### When to Use Fintech Domain
- Implementing payment processing logic
- Designing money movement flows
- Creating financial transaction models
- Implementing domain-specific business rules

---

## Core Concepts

### Payment Processing
- **Payment Intent** — Request to process a payment
- **Payment Method** — How payment will be processed (mobile money, bank transfer, etc.)
- **Payment Status** — State of the payment (pending, processing, completed, failed)
- **Payment Evidence** — Proof of payment (receipt, screenshot, etc.)

### Money Movement
- **Transfer** — Movement of funds between accounts
- **Settlement** — Finalization of payment processing
- **Reconciliation** — Matching transactions with bank statements
- **Ledger** — Record of all financial movements

### Financial Instruments
- **Mobile Money** — Mobile wallet payments (Unitel, Multichoice)
- **Bank Transfer** — Traditional bank transfers
- **Cash** — Cash payments
- **Card** — Credit/debit card payments (future)

---

## Domain Models

### Payment Intent
```typescript
interface PaymentIntent {
  id: string;
  amount: number;
  currency: 'AOA';
  paymentMethod: PaymentMethod;
  status: PaymentIntentStatus;
  evidence?: PaymentEvidence;
  organizationId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

type PaymentMethod = 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CASH';
type PaymentIntentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
```

### Payment Evidence
```typescript
interface PaymentEvidence {
  id: string;
  paymentIntentId: string;
  type: 'RECEIPT' | 'SCREENSHOT' | 'REFERENCE';
  imageUrl?: string;
  referenceNumber?: string;
  ocrResult?: OcrResult;
  verified: boolean;
}
```

### Transaction
```typescript
interface Transaction {
  id: string;
  type: 'PAYMENT' | 'TRANSFER' | 'REFUND' | 'SETTLEMENT';
  amount: number;
  currency: 'AOA';
  status: TransactionStatus;
  source: string;
  destination: string;
  metadata: Record<string, any>;
  organizationId: string;
  createdAt: Date;
}

type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
```

---

## Domain Services

### Payment Processing
```typescript
@Injectable()
export class PaymentProcessingService {
  async processPayment(intent: PaymentIntent): Promise<Transaction> {
    // 1. Validate payment intent
    // 2. Create transaction record
    // 3. Process payment via provider
    // 4. Update payment status
    // 5. Record audit event
    // 6. Return transaction
  }
}
```

### Money Movement
```typescript
@Injectable()
export class MoneyMovementService {
  async transfer(from: string, to: string, amount: number): Promise<Transaction> {
    // 1. Validate source balance
    // 2. Create transfer transaction
    // 3. Debit source account
    // 4. Credit destination account
    // 5. Record audit event
    // 6. Return transaction
  }
}
```

### Reconciliation
```typescript
@Injectable()
export class ReconciliationService {
  async reconcile(bankStatement: BankStatement): Promise<ReconciliationResult> {
    // 1. Match transactions with bank statement
    // 2. Identify discrepancies
    // 3. Create reconciliation report
    // 4. Flag unmatched transactions
    // 5. Return reconciliation result
  }
}
```

---

## Business Rules

### Payment Rules
1. **Amount validation** — Amount must be positive
2. **Currency validation** — Only AOA supported initially
3. **Evidence required** — All payments need evidence
4. **OCR verification** — Evidence must be verified via OCR
5. **Compliance check** — Must pass AGT/SAF-T compliance

### Money Movement Rules
1. **Balance check** — Source must have sufficient balance
2. **Tenant isolation** — Transfers within same organization
3. **Audit trail** — All movements must be logged
4. **Settlement** — Daily settlement of processed payments
5. **Reconciliation** — Daily reconciliation with bank statements

---

## Compliance Integration

### AGT Requirements
- Tax calculation on all transactions
- NIF validation for all parties
- SAF-T compliant record keeping
- Electronic invoicing where required

### SAF-T Requirements
- All transactions must be recorded
- Complete audit trail
- Standardized format for export
- Retention for required period

---

## Anti-Patterns

1. **Missing validation** — Always validate amounts and currencies
2. **No audit trail** — Never process payments without logging
3. **Skipping reconciliation** — Always reconcile with bank statements
4. **Incomplete evidence** — All payments need verified evidence

---

## Troubleshooting

### Common Issues

**Payment processing failing**
- Verify payment method is supported
- Check amount is valid
- Ensure evidence is provided
- Verify organization has permissions

**Money movement errors**
- Check source balance
- Verify destination account
- Ensure tenant isolation
- Check audit trail requirements

**Reconciliation discrepancies**
- Verify transaction amounts
- Check dates are correct
- Ensure all transactions are included
- Review unmatched transactions

---

## Observability

### Metrics
- `fintech_payments_total` — Total payments processed
- `fintech_transactions_total` — Total transactions
- `fintech_reconciliation_errors_total` — Reconciliation errors

### Logs
- Log all payment processing
- Log money movements
- Log reconciliation results

---

## Production Checklist

- [ ] Payment processing implemented
- [ ] Money movement logic working
- [ ] Reconciliation process automated
- [ ] Audit trail complete
- [ ] Compliance requirements met
- [ ] Domain rules enforced
