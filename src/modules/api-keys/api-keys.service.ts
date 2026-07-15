import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { AUDIT_ACTION, AuditEvent } from '../../common/events/audit.event';
import { ApiKey } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ApiKeyCreatedDto, CreateApiKeyDto } from './dto/api-key.dto';

const KEY_NAMESPACE = 'mwc';
/** How stale lastUsedAt may get; keeps hot paths from writing on every request. */
const LAST_USED_THROTTLE_MS = 60_000;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Minting and revoking credentials is exactly what an audit log is for. */
  private audit(
    websiteId: string,
    action: string,
    keyId: string,
    name: string,
  ) {
    this.events.emit(
      AUDIT_ACTION,
      new AuditEvent(websiteId, 'apikey', action, keyId, { name }),
    );
  }

  findAll(websiteId: string) {
    return this.prisma.apiKey.findMany({
      where: { websiteId },
      // keyHash is never selected: it must not leave this service.
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Returns the plaintext key exactly once — only the hash is stored. */
  async create(
    websiteId: string,
    dto: CreateApiKeyDto,
  ): Promise<ApiKeyCreatedDto> {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');

    const prefix = `${KEY_NAMESPACE}_${randomBytes(4).toString('hex')}`;
    const secret = randomBytes(24).toString('base64url');
    const plaintext = `${prefix}_${secret}`;
    const keyHash = await bcrypt.hash(plaintext, 10);

    const created = await this.prisma.apiKey.create({
      data: { websiteId, name: dto.name, prefix, keyHash },
    });
    this.audit(websiteId, 'created', created.id, created.name);
    return {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      key: plaintext,
      createdAt: created.createdAt,
    };
  }

  async revoke(websiteId: string, apiKeyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, websiteId },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (key.revokedAt) return { revoked: true, revokedAt: key.revokedAt };

    const updated = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });
    this.audit(websiteId, 'revoked', apiKeyId, key.name);
    return { revoked: true, revokedAt: updated.revokedAt };
  }

  async remove(websiteId: string, apiKeyId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, websiteId },
    });
    if (!key) throw new NotFoundException('API key not found');
    await this.prisma.apiKey.delete({ where: { id: apiKeyId } });
    this.audit(websiteId, 'deleted', apiKeyId, key.name);
    return { deleted: true };
  }

  /**
   * Resolves a plaintext key to its record, or null when it is malformed,
   * unknown, revoked, or belongs to another website.
   */
  async verify(plaintext: string, websiteId: string): Promise<ApiKey | null> {
    const prefix = extractPrefix(plaintext);
    if (!prefix) return null;

    const key = await this.prisma.apiKey.findUnique({ where: { prefix } });
    if (!key || key.websiteId !== websiteId || key.revokedAt) return null;

    const matches = await bcrypt.compare(plaintext, key.keyHash);
    if (!matches) return null;

    void this.touch(key);
    return key;
  }

  private async touch(key: ApiKey) {
    const stale =
      !key.lastUsedAt ||
      Date.now() - key.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS;
    if (!stale) return;
    await this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined); // best-effort telemetry, never fails a request
  }
}

/**
 * `mwc_<8 hex>_<secret>` -> `mwc_<8 hex>`
 *
 * Anchored match rather than split('_'): the secret is base64url, whose
 * alphabet includes '_', so splitting rejected roughly 40% of valid keys.
 */
const KEY_PATTERN = new RegExp(`^(${KEY_NAMESPACE}_[a-f0-9]{8})_(.+)$`);

function extractPrefix(plaintext: string): string | null {
  const match = KEY_PATTERN.exec(plaintext);
  return match ? match[1] : null;
}
