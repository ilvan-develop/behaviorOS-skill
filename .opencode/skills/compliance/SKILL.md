---
name: compliance
description: Enterprise compliance framework for fintech applications covering AGT, SAF-T, LGPD, PCI-DSS, and regulatory requirements. Use when implementing compliance features, audit trails, regulatory reporting, or data protection measures.
metadata:
  scope: compliance
  version: "1.0"
---

# Compliance Framework — FinPay v2

## Overview

Compliance framework for Angolan fintech applications covering regulatory requirements, audit trails, and data protection.

### When to Use Compliance
- Implementing audit trails for financial transactions
- Configuring AGT/SAF-T reporting
- Implementing LGPD data protection
- Setting up PCI-DSS for payment data
- Creating compliance reports

---

## Regulatory Framework

### AGT (Administração Geral Tributária)
- Tax reporting requirements for Angolan businesses
- SAF-T format for audit files
- Electronic invoicing compliance

### SAF-T (Standard Audit File for Tax)
- Standardized format for tax authority audits
- Required fields and structure
- Export procedures

### LGPD (Lei Geral de Proteção de Dados)
- Data protection requirements
- Consent management
- Data subject rights

### PCI-DSS
- Payment Card Industry Data Security Standard
- Cardholder data protection
- Security requirements

---

## Implementation Patterns

### Audit Trail Pattern
```typescript
// Every critical mutation must include AuditEvent
await prisma.$transaction(async (tx) => {
  const payment = await tx.payment.create({ data: paymentData });
  await tx.auditEvent.create({
    data: {
      action: 'PAYMENT_CREATED',
      entityId: payment.id,
      entityType: 'Payment',
      userId: currentUser.id,
      organizationId: orgId,
      timestamp: new Date(),
      details: { amount: payment.amount, currency: payment.currency },
    },
  });
  return payment;
});
```

### Data Protection Pattern
```typescript
// LGPD: Encrypt sensitive data
@Injectable()
export class DataProtectionService {
  encryptSensitiveData(data: string): string {
    // Implement encryption logic
    return encrypted;
  }
  
  anonymizeData(data: any): any {
    // Implement anonymization for reports
    return anonymized;
  }
}
```

---

## Compliance Gates

### Pre-Implementation Gate
- [ ] Compliance requirements identified
- [ ] Regulatory framework selected
- [ ] Data protection measures defined
- [ ] Audit trail requirements documented

### Implementation Gate
- [ ] Audit events implemented
- [ ] Data encryption implemented
- [ ] Consent management implemented
- [ ] Reporting endpoints created

### Post-Implementation Gate
- [ ] Compliance tests passing
- [ ] Audit trail verified
- [ ] Data protection verified
- [ ] Reporting functional

---

## Anti-Patterns

1. **Missing audit trail** — Never modify financial data without logging
2. **Hardcoded secrets** — Never store compliance credentials in code
3. **Incomplete data protection** — Always encrypt sensitive data
4. **Missing consent** — Always obtain consent for data processing

---

## Troubleshooting

### Common Issues

**Audit events not being created**
- Check transaction is being used
- Verify AuditEvent model exists
- Check organizationId is included

**SAF-T export failing**
- Verify all required fields are present
- Check date formats are correct
- Ensure amounts are in correct format

---

## Observability

### Metrics
- `compliance_audit_events_total` — Total audit events
- `compliance_data_protection_errors_total` — Data protection errors
- `compliance_saf_t_exports_total` — SAF-T export count

### Logs
- All compliance events should be logged
- Use structured logging for audit trail
- Include correlation IDs for tracing

---

## Production Checklist

- [ ] Audit trail implemented
- [ ] Data encryption configured
- [ ] Consent management implemented
- [ ] SAF-T export functional
- [ ] LGPD compliance verified
- [ ] PCI-DSS requirements met
