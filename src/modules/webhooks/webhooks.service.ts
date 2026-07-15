import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'crypto';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { AUDIT_ACTION, AuditEvent } from '../../common/events/audit.event';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

/** The secret signs payloads, so it is only revealed on create and rotate. */
const PUBLIC_SELECT = {
  id: true,
  name: true,
  url: true,
  events: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  private audit(websiteId: string, action: string, id: string, name?: string) {
    this.events.emit(
      AUDIT_ACTION,
      new AuditEvent(websiteId, 'webhook', action, id, { name }),
    );
  }

  findAll(websiteId: string) {
    return this.prisma.webhook.findMany({
      where: { websiteId },
      select: PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(websiteId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, websiteId },
      select: PUBLIC_SELECT,
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async create(websiteId: string, dto: CreateWebhookDto) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');

    const secret = generateSecret();
    const webhook = await this.prisma.webhook.create({
      data: {
        websiteId,
        name: dto.name,
        url: dto.url,
        events: dto.events,
        active: dto.active ?? true,
        secret,
      },
      select: PUBLIC_SELECT,
    });
    this.audit(websiteId, 'created', webhook.id, webhook.name);
    // Shown once here so the receiver can be configured to verify signatures.
    return { ...webhook, secret };
  }

  async update(websiteId: string, webhookId: string, dto: UpdateWebhookDto) {
    await this.findOne(websiteId, webhookId);
    return this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.events !== undefined ? { events: dto.events } : {}),
      },
      select: PUBLIC_SELECT,
    });
  }

  async rotateSecret(websiteId: string, webhookId: string) {
    await this.findOne(websiteId, webhookId);
    const secret = generateSecret();
    await this.prisma.webhook.update({
      where: { id: webhookId },
      data: { secret },
    });
    this.audit(websiteId, 'secret_rotated', webhookId);
    return { id: webhookId, secret };
  }

  async remove(websiteId: string, webhookId: string) {
    await this.findOne(websiteId, webhookId);
    await this.prisma.webhook.delete({ where: { id: webhookId } });
    this.audit(websiteId, 'deleted', webhookId);
    return { deleted: true };
  }

  /** Delivery log, so a silently failing receiver is visible. */
  async deliveries(
    websiteId: string,
    webhookId: string,
    pagination: PaginationDto,
  ) {
    await this.findOne(websiteId, webhookId);
    const where = { webhookId };
    const [items, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);
    return paginate(items, total, pagination);
  }

  /** Active webhooks on this website subscribed to the given event. */
  async findSubscribers(websiteId: string, event: string) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { websiteId, active: true },
    });
    return webhooks.filter((webhook) =>
      ((webhook.events as string[]) ?? []).includes(event),
    );
  }
}

function generateSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}
