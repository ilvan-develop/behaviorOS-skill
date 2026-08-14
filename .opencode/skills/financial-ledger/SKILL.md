---
name: financial-ledger
description: Financial ledger implementation for Angolan fintech applications. Use when implementing double-entry bookkeeping, account management, transaction recording, or financial reporting.
metadata:
  scope: ledger
  version: "1.0"
---

# Financial Ledger — FinPay v2

## Overview

Financial ledger implementation for Angolan fintech covering double-entry bookkeeping, account management, transaction recording, and financial reporting.

### When to Use Ledger
- Implementing double-entry bookkeeping
- Creating account management
- Recording financial transactions
- Generating financial reports
- Implementing reconciliation

---

## Ledger Concepts

### Double-Entry Bookkeeping
- Every transaction affects at least two accounts
- Debits must equal credits
- Accounts have normal balances (debit or credit)
- Chart of accounts defines account types

### Account Types
- **Assets** — Resources owned (cash, accounts receivable)
- **Liabilities** — Obligations (accounts payable, loans)
- **Equity** — Owner's claim (capital, retained earnings)
- **Revenue** — Income earned (service revenue, interest)
- **Expenses** — Costs incurred (operating expenses, taxes)

---

## Implementation Patterns

### Account Model
```typescript
interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: 'DEBIT' | 'CREDIT';
  organizationId: string;
  balance: number;
  currency: 'AOA';
  active: boolean;
}

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
```

### Transaction Entry
```typescript
interface LedgerEntry {
  id: string;
  transactionId: string;
  accountId: string;
  debit: number;
  credit: number;
  description: string;
  organizationId: string;
  timestamp: Date;
}
```

### Transaction
```typescript
interface LedgerTransaction {
  id: string;
  type: string;
  description: string;
  entries: LedgerEntry[];
  organizationId: string;
  createdAt: Date;
  reconciled: boolean;
}
```

---

## Ledger Service

### Recording Transactions
```typescript
@Injectable()
export class LedgerService {
  async recordTransaction(data: RecordTransactionDto, orgId: string): Promise<LedgerTransaction> {
    return this.prisma.$transaction(async (tx) => {
      // Validate debits equal credits
      const totalDebits = data.entries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredits = data.entries.reduce((sum, e) => sum + e.credit, 0);
      
      if (totalDebits !== totalCredits) {
        throw new Error('Debits must equal credits');
      }
      
      // Create transaction
      const transaction = await tx.ledgerTransaction.create({
        data: {
          type: data.type,
          description: data.description,
          organizationId: orgId,
        },
      });
      
      // Create entries
      for (const entry of data.entries) {
        await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            accountId: entry.accountId,
            debit: entry.debit,
            credit: entry.credit,
            description: entry.description,
            organizationId: orgId,
          },
        });
        
        // Update account balance
        await tx.account.update({
          where: { id: entry.accountId },
          data: {
            balance: {
              increment: entry.debit,
              decrement: entry.credit,
            },
          },
        });
      }
      
      return transaction;
    });
  }
}
```

### Account Management
```typescript
@Injectable()
export class AccountService {
  async create(data: CreateAccountDto, orgId: string): Promise<Account> {
    return this.prisma.account.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        normalBalance: data.normalBalance,
        organizationId: orgId,
        currency: 'AOA',
      },
    });
  }
  
  async getBalance(accountId: string, orgId: string): Promise<number> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId: orgId },
    });
    return account.balance;
  }
}
```

---

## Chart of Accounts

### Standard Accounts for FinPay
```
1000 - Cash
1010 - Mobile Money Wallet
1020 - Bank Account
1100 - Accounts Receivable
2000 - Accounts Payable
2100 - Taxes Payable
3000 - Owner's Equity
4000 - Service Revenue
4100 - Interest Revenue
5000 - Operating Expenses
5100 - Transaction Fees
5200 - Tax Expenses
```

---

## Compliance Integration

### AGT Requirements
- Record all financial transactions
- Maintain complete audit trail
- Generate SAF-T compliant reports
- Store for regulatory period

### Audit Trail
- Log all ledger entries
- Record account changes
- Track balance updates
- Store reconciliation results

---

## Anti-Patterns

1. **Unbalanced entries** — Debits must always equal credits
2. **Missing organizationId** — Always include for tenant isolation
3. **No audit trail** — Never modify ledger without logging
4. **Skipping reconciliation** — Always reconcile with bank statements

---

## Troubleshooting

### Common Issues

**Transaction recording failing**
- Verify debits equal credits
- Check account exists
- Ensure organizationId is provided
- Verify account is active

**Balance calculation errors**
- Check entry amounts
- Verify account type
- Ensure no duplicate entries
- Review transaction history

**Reconciliation discrepancies**
- Verify transaction amounts
- Check dates are correct
- Ensure all transactions included
- Review unmatched entries

---

## Observability

### Metrics
- `ledger_transactions_total` — Total ledger transactions
- `ledger_entries_total` — Total ledger entries
- `ledger_reconciliation_errors_total` — Reconciliation errors

### Logs
- Log all transaction recording
- Log account balance changes
- Log reconciliation results

---

## Production Checklist

- [ ] Double-entry bookkeeping implemented
- [ ] Chart of accounts defined
- [ ] Transaction recording working
- [ ] Account management functional
- [ ] Reconciliation process automated
- [ ] Audit trail complete
