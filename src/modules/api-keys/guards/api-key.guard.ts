import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WebsiteStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ApiKeysService } from '../api-keys.service';

export const API_KEY_HEADER = 'x-api-key';

/**
 * Gates the public Content API. Enforcement is per website: a key is only
 * mandatory when Website.requireApiKey is on, so existing frontends keep
 * working until their website opts in.
 *
 * A key is still verified and attached when supplied, which is what the
 * rate limiter buckets on.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawSlug = request.params?.websiteSlug;
    const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
    if (!slug) return true;

    const website = await this.prisma.website.findFirst({
      where: { slug, status: WebsiteStatus.ACTIVE },
      select: { id: true, requireApiKey: true },
    });
    // Unknown/inactive website: stay quiet here and let the service answer 404,
    // so this guard can't be used to probe which websites exist.
    if (!website) return true;

    const provided = readHeader(request, API_KEY_HEADER);
    if (!provided) {
      if (!website.requireApiKey) return true;
      throw new UnauthorizedException(
        `This website requires an API key; send it in the ${API_KEY_HEADER} header`,
      );
    }

    const key = await this.apiKeys.verify(provided, website.id);
    if (!key) {
      // An invalid key is always rejected, even where a key is optional:
      // silently downgrading to anonymous would hide a misconfigured client.
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    request.apiKey = { id: key.id, websiteId: key.websiteId };
    return true;
  }
}

function readHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}
