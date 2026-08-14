---
name: saf-t
description: SAF-T (Standard Audit File for Tax) implementation for Angolan fintech applications. Use when creating audit file exports, tax reporting structures, or regulatory compliance for tax authority audits.
metadata:
  scope: compliance
  format: "SAF-T"
  version: "1.0"
---

# SAF-T Implementation — FinPay v2

## Overview

SAF-T (Standard Audit File for Tax) is a standardized format for tax authority audits. Required for Angolan businesses to provide audit files to AGT.

### When to Use SAF-T
- Creating audit file exports for tax authority
- Implementing standardized reporting format
- Preparing for tax audits
- Implementing data export functionality

---

## SAF-T Structure

### Header Section
```typescript
interface SafTHeader {
  company: string;
  nif: string;
  taxRegistrationNumber: string;
  fiscalYear: number;
  startDate: Date;
  endDate: Date;
  currency: 'AOA';
 生成日期: Date;
}
```

### Master Data
```typescript
interface SafTMasterData {
  customers: SafTCustomer[];
  suppliers: SafTSupplier[];
  products: SafTProduct[];
  taxTable: SafTTaxTable[];
}
```

### Transactions
```typescript
interface SafTTransaction {
  documentNumber: string;
  documentType: string;
  documentDate: Date;
  customerNif: string;
  customerName: string;
  items: SafTLineItem[];
  totalAmount: number;
  taxAmount: number;
  currency: 'AOA';
}
```

### Line Items
```typescript
interface SafTLineItem {
  lineNumber: number;
  productCode: string;
  productDescription: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}
```

---

## Implementation Patterns

### SAF-T Generator Pattern
```typescript
@Injectable()
export class SafTGeneratorService {
  async generateSafT(organizationId: string, startDate: Date, endDate: Date): Promise<SafTFile> {
    const header = await this.generateHeader(organizationId, startDate, endDate);
    const masterData = await this.generateMasterData(organizationId);
    const transactions = await this.generateTransactions(organizationId, startDate, endDate);
    
    return {
      header,
      masterData,
      transactions,
      generatedAt: new Date(),
    };
  }
  
  private async generateHeader(orgId: string, start: Date, end: Date): Promise<SafTHeader> {
    const org = await this.organizationService.findById(orgId);
    return {
      company: org.name,
      nif: org.nif,
      taxRegistrationNumber: org.taxRegistrationNumber,
      fiscalYear: start.getFullYear(),
      startDate: start,
      endDate: end,
      currency: 'AOA',
      生成日期: new Date(),
    };
  }
}
```

### Export Pattern
```typescript
@Injectable()
export class SafTExportService {
  async exportToFile(organizationId: string, startDate: Date, endDate: Date): Promise<string> {
    const safTData = await this.generator.generateSafT(organizationId, startDate, endDate);
    const xml = this.convertToXml(safTData);
    const filePath = `./exports/saf-t-${organizationId}-${startDate.toISOString()}.xml`;
    await writeFile(filePath, xml);
    return filePath;
  }
}
```

---

## Required Fields

### Header
- Company name
- NIF
- Tax registration number
- Fiscal year
- Start/end dates
- Currency

### Transactions
- Document number
- Document type
- Document date
- Customer NIF
- Customer name
- Line items
- Totals
- Tax amounts

### Master Data
- Customer information
- Supplier information
- Product information
- Tax rates

---

## Compliance Gates

### Pre-Implementation Gate
- [ ] SAF-T structure defined
- [ ] Required fields identified
- [ ] Export format decided (XML)
- [ ] Data sources mapped

### Implementation Gate
- [ ] Header generation implemented
- [ ] Master data generation implemented
- [ ] Transaction generation implemented
- [ ] Export functionality implemented

### Post-Implementation Gate
- [ ] SAF-T format validated
- [ ] Test export successful
- [ ] AGT format compliance verified
- [ ] Export automation working

---

## Anti-Patterns

1. **Missing required fields** — All mandatory fields must be populated
2. **Incorrect date formats** — Use ISO format (YYYY-MM-DD)
3. **Missing tax calculations** — All tax amounts must be calculated
4. **Incomplete master data** — All customers/products must be included

---

## Troubleshooting

### Common Issues

**SAF-T export failing**
- Verify all required fields are populated
- Check date formats are correct
- Ensure amounts are in AOA format
- Verify NIF formats are valid

**XML generation errors**
- Check XML structure matches SAF-T schema
- Verify special characters are escaped
- Ensure encoding is UTF-8

**Data completeness errors**
- Verify all transactions are included
- Check master data is complete
- Ensure tax calculations are accurate

---

## Observability

### Metrics
- `saf_t_exports_total` — Total SAF-T exports
- `saf_t_export_errors_total` — Export errors
- `saf_t_records_total` — Total records exported

### Logs
- Log all export attempts
- Log validation errors
- Log file generation success/failure

---

## Production Checklist

- [ ] SAF-T structure implemented
- [ ] All required fields included
- [ ] Export functionality working
- [ ] Format validated against AGT requirements
- [ ] Test export successful
- [ ] Automation configured
