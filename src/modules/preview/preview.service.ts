import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface PreviewClaims {
  websiteId: string;
  scope: 'preview';
}

/**
 * Lets a frontend render unpublished content without exposing drafts publicly.
 *
 * A signed, short-lived token rather than a stored row: nothing to clean up,
 * and it expires on its own. Scoped to one website so a token from website A
 * can never reveal website B's drafts.
 */
@Injectable()
export class PreviewService {
  private readonly ttl: SignOptions['expiresIn'];

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // Same cast as AuthModule: @nestjs/jwt types expiresIn narrowly.
    this.ttl = config.get<string>(
      'PREVIEW_TOKEN_TTL',
      '1h',
    ) as SignOptions['expiresIn'];
  }

  async issue(websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');

    const claims: PreviewClaims = { websiteId, scope: 'preview' };
    const token = await this.jwt.signAsync(claims, { expiresIn: this.ttl });
    return { token, expiresIn: this.ttl, websiteSlug: website.slug };
  }

  /** True only for a valid, unexpired preview token issued for this website. */
  async isValidFor(token: string | undefined, websiteId: string) {
    if (!token) return false;
    try {
      const claims = await this.jwt.verifyAsync<PreviewClaims>(token);
      return claims.scope === 'preview' && claims.websiteId === websiteId;
    } catch {
      return false;
    }
  }
}
