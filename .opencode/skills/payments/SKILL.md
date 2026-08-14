---
name: payments
description: Payment processing implementation for Angolan fintech applications. Use when implementing payment APIs, payment methods, payment evidence, OCR verification, or payment status management.
metadata:
  scope: payments
  version: "1.0"
---

# Payment Processing — FinPay v2

## Overview

Payment processing implementation for Angolan fintech covering payment intents, evidence collection, OCR verification, and payment status management.

### When to Use Payments
- Implementing payment APIs
- Creating payment methods
- Processing payment evidence
- Implementing OCR verification
- Managing payment status

---

## Payment Flow

```
Payment Intent → Evidence → OCR → Compliance → Fraud → Trust Score → Decision → Ledger → Webhook
```

### Payment States
1. **Created** — Payment intent created
2. **Evidence Uploaded** — Evidence provided
3. **OCR Processing** — OCR analyzing evidence
4. **Compliance Check** — AGT/SAF-T validation
5. **Fraud Check** — Fraud detection
6. **Trust Score** — Risk assessment
7. **Decision** — Approved/Rejected/Under Review
8. **Settled** — Funds settled
9. **Reconciled** — Matched with bank statement

---

## Implementation Patterns

### Payment Intent Creation
```typescript
@Injectable()
export class PaymentIntentService {
  async create(data: CreatePaymentIntentDto, orgId: string, userId: string): Promise<PaymentIntent> {
    return this.prisma.$transaction(async (tx) => {
      const intent = await tx.paymentIntent.create({
        data: {
          amount: data.amount,
          currency: 'AOA',
          paymentMethod: data.paymentMethod,
          status: 'CREATED',
          organizationId: orgId,
          userId,
        },
      });
      
      await tx.auditEvent.create({
        data: {
          action: 'PAYMENT_INTENT_CREATED',
          entityId: intent.id,
          entityType: 'PaymentIntent',
          userId,
          organizationId: orgId,
        },
      });
      
      return intent;
    });
  }
}
```

### Evidence Upload
```typescript
@Injectable()
export class PaymentEvidenceService {
  async upload(paymentIntentId: string, evidence: EvidenceUploadDto, orgId: string): Promise<PaymentEvidence> {
    const intent = await this.validateOwnership(paymentIntentId, orgId);
    
    return this.prisma.$transaction(async (tx) => {
      const evidenceRecord = await tx.paymentEvidence.create({
        data: {
          paymentIntentId,
          type: evidence.type,
          imageUrl: evidence.imageUrl,
          referenceNumber: evidence.referenceNumber,
        },
      });
      
      await tx.paymentIntent.update({
        where: { id: paymentIntentId },
        data: { status: 'EVIDENCE_UPLOADED' },
      });
      
      return evidenceRecord;
    });
  }
}
```

### OCR Processing
```typescript
@Injectable()
export class OcrProcessingService {
  async process(evidenceId: string, orgId: string): Promise<OcrResult> {
    const evidence = await this.validateOwnership(evidenceId, orgId);
    
    // Call OCR worker (FastAPI + Tesseract)
    const ocrResult = await this.ocrWorkerService.process(evidence.imageUrl);
    
    // Store result
    await this.prisma.paymentEvidence.update({
      where: { id: evidenceId },
      data: {
        ocrResult: {
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          fields: ocrResult.fields,
        },
        verified: ocrResult.confidence > 0.8,
      },
    });
    
    return ocrResult;
  }
}
```

---

## Payment Methods

### Mobile Money
```typescript
interface MobileMoneyPayment {
  provider: 'UNITEL' | 'MULTICHOICE';
  phoneNumber: string;
  reference: string;
}
```

### Bank Transfer
```typescript
interface BankTransferPayment {
  bankName: string;
  accountNumber: string;
  reference: string;
  proofOfTransfer: string;
}
```

### Cash
```typescript
interface CashPayment {
  location: string;
  receivedBy: string;
  receipt: string;
}
```

---

## Compliance Integration

### AGT Validation
- Validate NIF for all parties
- Calculate applicable taxes
- Generate SAF-T compliant records
- Store for regulatory reporting

### Audit Trail
- Log all payment state changes
- Record evidence processing
- Track OCR results
- Store compliance decisions

---

## Anti-Patterns

1. **Missing evidence** — Never process payments without evidence
2. **Skipping OCR** — Always verify evidence via OCR
3. **No audit trail** — Never modify payment state without logging
4. **Missing tenant isolation** — Always include organizationId

---

## Troubleshooting

### Common Issues

**Payment creation failing**
- Verify payment method is supported
- Check amount is valid
- Ensure organizationId is provided
- Verify user has permissions

**OCR processing errors**
- Check image quality
- Verify OCR worker is running
- Ensure image URL is accessible
- Check OCR service configuration

**Compliance validation failing**
- Verify NIF is valid
- Check tax calculations
- Ensure SAF-T fields are complete
- Verify audit trail is recorded

---

## Observability

### Metrics
- `payments_created_total` — Total payment intents created
- `payments_processed_total` — Total payments processed
- `payments_ocr_confidence` — OCR confidence scores
- `payments_compliance_errors_total` — Compliance errors

### Logs
- Log all payment state changes
- Log OCR processing results
- Log compliance validation

---

## Production Checklist

- [ ] Payment intent creation working
- [ ] Evidence upload functional
- [ ] OCR processing implemented
- [ ] Compliance validation working
- [ ] Audit trail complete
- [ ] Payment methods supported
