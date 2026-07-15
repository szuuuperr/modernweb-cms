import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Rate limits the public Content API. Buckets by API key when one was supplied
 * so that clients behind a shared NAT don't consume each other's budget, and
 * fall back to IP for anonymous reads.
 */
@Injectable()
export class ContentThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const key = req.apiKey?.id;
    return Promise.resolve(key ? `key:${key}` : `ip:${req.ip}`);
  }
}
