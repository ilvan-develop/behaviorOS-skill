---
name: agt
description: AGT (Administração Geral Tributária) compliance for Angolan fintech applications. Use when implementing tax reporting, electronic invoicing, or regulatory compliance for Angolan tax authority requirements.
metadata:
  scope: compliance
  region: Angola
  version: "1.0"
---

# AGT Compliance — FinPay v2

## Overview

AGT (Administração Geral Tributária) is the Angolan general tax administration. Compliance requires specific reporting formats, electronic invoicing, and audit file preparation.

### When to Use AGT
- Implementing tax reporting for Angolan businesses
- Creating electronic invoices
- Preparing audit files for tax authority
- Implementing tax calculation logic

---

## AGT Requirements

### Tax Identification
- NIF (Número de Identificação Fiscal) required for all businesses
- Tax registration with AGT
- Annual tax declarations

### Electronic Invoicing
- Mandatory for certain business types
- Specific XML format required
- Digital signature requirements

### SAF-T Reporting
- Standard Audit File for Tax
- Monthly/quarterly reporting
- Specific data structure required

---

## Implementation Patterns

### NIF Validation Pattern
```typescript
@Injectable()
export class NifValidationService {
  validateNif(nif: string): boolean {
    // Angolan NIF validation logic
    // Format: 9 digits
    return /^\d{9}$/.test(nif);
  }
  
  formatNif(nif: string): string {
    // Format NIF for display
    return nif.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  }
}
```

### Tax Calculation Pattern
```typescript
@Injectable()
export class TaxCalculationService {
  calculateIva(amount: number, rate: number = 14): number {
    // IVA (Imposto sobre o Valor Acrescentado) calculation
    return amount * (rate / 100);
  }
  
  calculateIrps(amount: number): number {
    // IRPS (Imposto sobre Rendimentos Profissionais e Salários)
    // Progressive rates
    if (amount <= 70000) return 0;
    if (amount <= 100000) return (amount - 70000) * 0.10;
    if (amount <= 150000) return 3000 + (amount - 100000) * 0.13;
    if (amount <= 200000) return 9500 + (amount - 150000) * 0.16;
    return 17500 + (amount - 200000) * 0.18;
  }
}
```

---

## Data Structure

### Tax Transaction
```typescript
interface TaxTransaction {
  id: string;
  nif: string;
  transactionType: 'SALE' | 'PURCHASE' | 'SERVICE';
  amount: number;
  iva: number;
  irps: number;
  total: number;
  currency: 'AOA';
  timestamp: Date;
  organizationId: string;
}
```

### SAF-T Record
```typescript
interface SafTRecord {
  recordType: string;
  documentNumber: string;
  documentDate: Date;
  nif: string;
  customerName: string;
  items: SafTItem[];
  totalAmount: number;
  ivaAmount: number;
  currency: 'AOA';
}
```

---

## Compliance Gates

### Pre-Implementation Gate
- [ ] NIF validation implemented
- [ ] Tax calculation logic implemented
- [ ] SAF-T structure defined
- [ ] Electronic invoicing format defined

### Implementation Gate
- [ ] Tax transactions recorded
- [ ] SAF-T export functional
- [ ] Electronic invoicing working
- [ ] Tax reports generated

### Post-Implementation Gate
- [ ] AGT format validated
- [ ] Test data verified
- [ ] Export functionality tested
- [ ] Compliance audit passed

---

## Anti-Patterns

1. **Missing NIF** — Never process transactions without valid NIF
2. **Incorrect tax calculation** — Always use correct rates
3. **Incomplete SAF-T records** — All required fields must be present
4. **Missing digital signature** — Electronic invoices must be signed

---

## Troubleshooting

### Common Issues

**NIF validation failing**
- Verify NIF format is 9 digits
- Check for leading zeros
- Ensure no special characters

**SAF-T export errors**
- Verify all required fields are populated
- Check date formats (YYYY-MM-DD)
- Ensure amounts are in AOA format

**Tax calculation errors**
- Verify correct tax rates are used
- Check rounding rules
- Ensure currency is AOA

---

## Observability

### Metrics
- `agt_transactions_total` — Total tax transactions
- `agt_saf_t_exports_total` — SAF-T export count
- `agt_tax_calculations_total` — Tax calculation count

### Logs
- Log all tax calculations
- Log SAF-T exports
- Log validation errors

---

## Production Checklist

- [ ] NIF validation implemented
- [ ] Tax calculation accurate
- [ ] SAF-T export functional
- [ ] Electronic invoicing working
- [ ] AGT format validated
- [ ] Test data verified
