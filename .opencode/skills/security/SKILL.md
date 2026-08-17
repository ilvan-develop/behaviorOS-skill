---
name: security
description: Security implementation for Angolan fintech applications covering authentication, authorization, encryption, and security best practices. Use when implementing security features, RBAC, data protection, or security audits.
metadata:
  scope: security
  version: "1.0"
---

# Security Implementation — FinPay v2

## Overview

Security implementation for Angolan fintech covering authentication, authorization, encryption, and security best practices.

### When to Use Security
- Implementing authentication
- Setting up authorization (RBAC)
- Encrypting sensitive data
- Conducting security audits
- Implementing security best practices

---

## Security Layers

### Authentication
- **Better Auth** — Multi-tenant authentication
- **JWT Tokens** — Secure session management
- **API Keys** — Service-to-service authentication
- **MFA** — Multi-factor authentication (future)

### Authorization
- **RBAC** — Role-based access control
- **Tenant Isolation** — Organization-level isolation
- **Permission Gates** — Fine-grained permissions
- **Audit Logging** — All access attempts logged

### Data Protection
- **Encryption at Rest** — AES-256 for stored data
- **Encryption in Transit** — TLS 1.3 for all communication
- **Data Masking** — Sensitive data masking in logs
- **Key Management** — Secure key rotation

---

## Implementation Patterns

### RBAC Pattern
```typescript
@Injectable()
export class AuthorizationService {
  async checkPermission(userId: string, resource: string, action: string, orgId: string): Promise<boolean> {
    const user = await this.userService.findByIdWithRoles(userId, orgId);
    
    for (const role of user.roles) {
      const permissions = await this.roleService.getPermissions(role.id);
      if (permissions.some(p => p.resource === resource && p.action === action)) {
        return true;
      }
    }
    
    return false;
  }
}
```

### Data Encryption Pattern
```typescript
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;
  
  constructor() {
    this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }
  
  encrypt(data: string): EncryptedData {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }
  
  decrypt(encryptedData: EncryptedData): string {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Security Audit Pattern
```typescript
@Injectable()
export class SecurityAuditService {
  async auditAccess(userId: string, resource: string, action: string, result: 'SUCCESS' | 'FAILURE'): Promise<void> {
    await this.auditService.log({
      type: 'SECURITY_ACCESS',
      userId,
      resource,
      action,
      result,
      timestamp: new Date(),
    });
  }
  
  async auditDataAccess(userId: string, dataType: string, operation: string): Promise<void> {
    await this.auditService.log({
      type: 'DATA_ACCESS',
      userId,
      dataType,
      operation,
      timestamp: new Date(),
    });
  }
}
```

---

## Security Best Practices

### Code Security
- Never hardcode secrets
- Use environment variables
- Validate all inputs
- Sanitize all outputs
- Use parameterized queries

### API Security
- Rate limiting on all endpoints
- Input validation with Zod
- CORS configuration
- Helmet for HTTP headers
- API key authentication for services

### Data Security
- Encrypt sensitive data at rest
- Use TLS for all communication
- Mask sensitive data in logs
- Implement data retention policies
- Regular security audits

---

## Compliance Integration

### PCI-DSS
- Protect cardholder data
- Maintain secure systems
- Implement access control
- Regular monitoring and testing

### LGPD
- Obtain consent for data processing
- Implement data subject rights
- Data protection impact assessments
- Breach notification procedures

---

## Anti-Patterns

1. **Hardcoded secrets** — Never store secrets in code
2. **Missing validation** — Always validate inputs
3. **No audit logging** — Always log security events
4. **Weak passwords** — Enforce strong password policies

---

## Troubleshooting

### Common Issues

**Authentication failing**
- Verify Better Auth configuration
- Check JWT token validity
- Ensure proper tenant isolation
- Review authentication logs

**Authorization errors**
- Verify RBAC permissions
- Check role assignments
- Ensure tenant isolation
- Review authorization logs

**Encryption errors**
- Verify encryption key
- Check data format
- Ensure proper initialization
- Review encryption logs

---

## Observability

### Metrics
- `security_auth_attempts_total` — Authentication attempts
- `security_auth_failures_total` — Authentication failures
- `security_authorization_errors_total` — Authorization errors
- `security_data_access_total` — Data access attempts

### Logs
- Log all authentication attempts
- Log all authorization checks
- Log all data access
- Log security events

---

## Production Checklist

- [ ] Authentication implemented
- [ ] Authorization (RBAC) configured
- [ ] Data encryption working
- [ ] Security audit logging enabled
- [ ] Compliance requirements met
- [ ] Security best practices followed
