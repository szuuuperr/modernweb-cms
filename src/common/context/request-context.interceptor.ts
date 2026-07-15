import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user';
import { RequestContextStore } from './request-context';

/**
 * Opens the request-scoped context for every request.
 *
 * Registered as a global interceptor, which Nest runs *after* the guards — so
 * request.user is already populated by JwtAuthGuard and request.apiKey by
 * ApiKeyGuard by the time we read them.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;

    return RequestContextStore.run(
      {
        userId: user?.id,
        userEmail: user?.email,
        apiKeyId: request.apiKey?.id,
        ip: request.ip,
      },
      () => next.handle(),
    );
  }
}
