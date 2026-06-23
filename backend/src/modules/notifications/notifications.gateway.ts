import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsersRepository } from '../users/users.repository';
import { UserRole, UserStatus } from '../users/schemas/user.schema';

const ADMIN_ROLES: string[] = [
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.MODERATOR,
];

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@WebSocketGateway({
  cors: { origin: process.env['FRONTEND_URL'] ?? '*', credentials: true },
  namespace: '/',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token =
        (socket.handshake.auth as Record<string, string>).token ??
        (socket.handshake.headers.authorization ?? '').replace('Bearer ', '');

      if (!token) {
        socket.disconnect();
        return;
      }

      const secret = this.configService.get<string>('jwt.accessSecret') ?? '';
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret,
      });

      const user = await this.usersRepository.findById(payload.sub);
      if (!user || user.status !== UserStatus.ACTIVE) {
        socket.disconnect();
        return;
      }

      const userId = (user._id as { toString(): string }).toString();
      (socket as Socket & { userId: string }).userId = userId;

      await socket.join(`user:${userId}`);
      if (ADMIN_ROLES.includes(user.role)) {
        await socket.join('admin');
      }

      this.logger.log(
        `[Gateway] Connected: ${userId} (${user.role}) socket=${socket.id}`,
      );
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket): void {
    this.logger.log(`[Gateway] Disconnected: socket=${socket.id}`);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToAdmin(event: string, data: unknown): void {
    this.server.to('admin').emit(event, data);
  }

  broadcast(event: string, data: unknown): void {
    this.server.emit(event, data);
  }
}
