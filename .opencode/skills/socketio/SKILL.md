---
name: socketio
description: Enterprise Socket.IO 4.x real-time WebSocket with namespaces, rooms, adapters, middleware, and Redis scaling. Use when implementing real-time features, notifications, or live updates.
metadata:
  stack: socketio-4
  scope: realtime
  version: "4.8"
---

# Socket.IO 4.x Enterprise Real-Time Guide

## Overview

Socket.IO enables real-time, bidirectional, event-based communication between browser and server.

### When to Use Socket.IO
- Real-time notifications
- Chat applications
- Live dashboards
- Collaborative editing
- Multiplayer games

---

## Server Setup (NestJS)

```typescript
// src/modules/notifications/notifications.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    client.join(`room:${roomId}`);
    this.logger.log(`Client ${client.id} joined room ${roomId}`);
    return { event: 'room-joined', data: roomId };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    client.leave(`room:${roomId}`);
    return { event: 'room-left', data: roomId };
  }

  // Emit to specific user
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Broadcast to room
  broadcastToRoom(room: string, event: string, data: any) {
    this.server.to(`room:${room}`).emit(event, data);
  }

  // Broadcast to all
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }
}
```

---

## Client Setup

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3001/notifications', {
  auth: { token: 'user-token' },
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on('connect', () => console.log('Connected:', socket.id));
socket.on('disconnect', (reason) => console.log('Disconnected:', reason));
socket.on('notification', (data) => console.log('Notification:', data));

socket.emit('join-room', 'order-123');
```

---

## React Hook

```typescript
import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(url: string, token?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(url, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [url, token]);

  const joinRoom = useCallback((roomId: string) => {
    socket?.emit('join-room', roomId);
  }, [socket]);

  const leaveRoom = useCallback((roomId: string) => {
    socket?.emit('leave-room', roomId);
  }, [socket]);

  return { socket, isConnected, joinRoom, leaveRoom };
}
```

---

## Redis Adapter (Scaling)

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.adapter(createAdapter(pubClient, subClient));
```

---

## Auth Middleware

```typescript
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const user = await verifyToken(token);
    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});
```

---

## Anti-Patterns

### ❌ No Authentication
```typescript
// BAD: Anyone can connect
io.use((socket, next) => next());
```

### ✅ Verify Tokens
```typescript
// GOOD: Verify authentication
io.use(async (socket, next) => {
  const user = await verifyToken(socket.handshake.auth.token);
  if (!user) return next(new Error('Unauthorized'));
  socket.data.user = user;
  next();
});
```

### ❌ Memory Adapter in Production
```typescript
// BAD: Doesn't scale
io.adapter(createAdapter());
```

### ✅ Redis Adapter
```typescript
// GOOD: Scales horizontally
io.adapter(createAdapter(pubClient, subClient));
```

---

## Production Checklist

- [ ] Authentication middleware configured
- [ ] CORS configured with explicit origins
- [ ] Redis adapter for scaling
- [ ] Ping/pong for connection health
- [ ] Rate limiting on connections
- [ ] Room-based broadcasting
- [ ] Error handling on client
- [ ] Reconnection logic on client

---

## Team Conventions

### Event Naming
```typescript
// Consistent naming
'order:created'
'order:updated'
'user:connected'
'notification:new'
```

### Room Naming
```typescript
// Consistent naming
`user:${userId}`     // User-specific
`order:${orderId}`   // Order-specific
`org:${orgId}`       // Organization-wide
```
