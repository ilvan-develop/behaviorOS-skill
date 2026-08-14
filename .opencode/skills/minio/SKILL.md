---
name: minio
description: Enterprise MinIO 8.x object storage with file uploads, presigned URLs, bucket policies, and integration patterns. Use when implementing file storage, image uploads, or object management.
metadata:
  stack: minio-8
  scope: infrastructure
  version: "8.0"
---

# MinIO 8.x Enterprise Object Storage Guide

## Overview

MinIO is a high-performance, S3-compatible object storage system. It's ideal for building cloud-native applications.

### When to Use MinIO
- File storage (images, documents, videos)
- Backup and archival storage
- Data lake storage
- S3-compatible storage needs
- Self-hosted object storage

---

## Client Setup

```typescript
// src/lib/minio.ts
import * as Minio from 'minio';
import { Logger } from '@nestjs/common';

const logger = new Logger('MinIO');

export const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
  pathStyle: true,
});

export async function initializeBucket(bucketName: string) {
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName, 'us-east-1');
    await minioClient.setBucketPolicy(bucketName, JSON.stringify({
      Version: '2012-10-17',
      Statement: [{
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucketName}/public/*`],
      }],
    }));
    logger.log(`Bucket ${bucketName} created`);
  }
}
```

---

## File Operations

```typescript
// Upload from buffer
const result = await minioClient.putObject(
  'uploads',
  `avatars/${userId}/${filename}`,
  fileBuffer,
  fileBuffer.length,
  { 'Content-Type': fileMimetype }
);

// Upload from stream
const stream = fs.createReadStream('/path/to/file');
await minioClient.putObject('uploads', key, stream);

// Presigned URL for download (1 hour)
const url = await minioClient.presignedGetObject('uploads', fileKey, 3600);

// Presigned URL for upload (1 hour)
const uploadUrl = await minioClient.presignedPutObject('uploads', key, 3600);

// List files
const stream = minioClient.listObjects('uploads', 'avatars/', true);
const files: string[] = [];
for await (const obj of stream) {
  files.push(obj.name);
}

// Get file stat
const stat = await minioClient.statObject('uploads', fileKey);

// Delete file
await minioClient.removeObject('uploads', fileKey);
```

---

## NestJS Integration

```typescript
// src/modules/storage/storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT),
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });
  }

  async uploadFile(bucket: string, key: string, buffer: Buffer, contentType: string) {
    await this.client.putObject(bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return { bucket, key };
  }

  async getPresignedUrl(bucket: string, key: string, expiresIn = 3600) {
    return this.client.presignedGetObject(bucket, key, expiresIn);
  }

  async deleteFile(bucket: string, key: string) {
    await this.client.removeObject(bucket, key);
  }
}
```

---

## Anti-Patterns

### ❌ No Content-Type
```typescript
// BAD: Files may not render correctly
await minioClient.putObject('bucket', key, buffer);
```

### ✅ Set Content-Type
```typescript
// GOOD: Files render correctly
await minioClient.putObject('bucket', key, buffer, buffer.length, {
  'Content-Type': 'application/pdf',
});
```

### ❌ Public Access Without Policy
```typescript
// BAD: Security risk
await minioClient.makeBucket('public-bucket');
```

### ✅ Restrict Access
```typescript
// GOOD: Only public/* prefix is public
await minioClient.setBucketPolicy(bucket, restrictedPolicy);
```

---

## Production Checklist

- [ ] Buckets created with proper policies
- [ ] Content-Type set on all uploads
- [ ] Presigned URLs for client uploads
- [ ] File size limits enforced
- [ ] Backup strategy configured
- [ ] Monitoring enabled
- [ ] Access keys rotated regularly
- [ ] CORS configured for browser access

---

## Team Conventions

### Key Structure
```typescript
// Consistent naming
'avatars/{userId}/{filename}'     // User avatars
'documents/{userId}/{filename}'   // User documents
'temp/{uuid}/{filename}'          // Temporary files
'exports/{date}/{filename}'       // Exports
```

### File Validation
```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

if (!ALLOWED_TYPES.includes(file.mimetype)) {
  throw new BadRequestException('File type not allowed');
}
if (file.size > MAX_SIZE) {
  throw new BadRequestException('File too large');
}
```
