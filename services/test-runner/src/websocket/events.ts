import { Server as SocketServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { ExecutionStatus, TestResult, WebSocketEvents } from '../types/index.js';
import { config } from '../config.js';

let io: SocketServer | null = null;

export function initializeWebSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('subscribe:execution', (executionId: string) => {
      socket.join(`execution:${executionId}`);
      console.log(`Client ${socket.id} subscribed to execution: ${executionId}`);
    });

    socket.on('unsubscribe:execution', (executionId: string) => {
      socket.leave(`execution:${executionId}`);
      console.log(`Client ${socket.id} unsubscribed from execution: ${executionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getSocketServer(): SocketServer {
  if (!io) {
    throw new Error('WebSocket server not initialized');
  }
  return io;
}

export function emitExecutionStarted(executionId: string, scenarioId: string): void {
  if (!io) return;

  const event: WebSocketEvents['execution:started'] = { executionId, scenarioId };
  io.to(`execution:${executionId}`).emit('execution:started', event);
  io.emit('execution:started', event);
}

export function emitExecutionProgress(
  executionId: string,
  step: number,
  total: number,
  message: string
): void {
  if (!io) return;

  const event: WebSocketEvents['execution:progress'] = {
    executionId,
    step,
    total,
    message,
  };
  io.to(`execution:${executionId}`).emit('execution:progress', event);
}

export function emitExecutionCompleted(
  executionId: string,
  status: ExecutionStatus,
  results?: TestResult
): void {
  if (!io) return;

  const event: WebSocketEvents['execution:completed'] = {
    executionId,
    status,
    results,
  };
  io.to(`execution:${executionId}`).emit('execution:completed', event);
  io.emit('execution:completed', event);
}

export function emitExecutionError(executionId: string, error: string): void {
  if (!io) return;

  const event: WebSocketEvents['execution:error'] = { executionId, error };
  io.to(`execution:${executionId}`).emit('execution:error', event);
}

export function emitExecutionLog(
  executionId: string,
  level: string,
  message: string
): void {
  if (!io) return;

  const event: WebSocketEvents['execution:log'] = {
    executionId,
    level,
    message,
    timestamp: new Date(),
  };
  io.to(`execution:${executionId}`).emit('execution:log', event);
}

export function broadcastToAll<K extends keyof WebSocketEvents>(
  event: K,
  data: WebSocketEvents[K]
): void {
  if (!io) return;
  io.emit(event, data);
}
