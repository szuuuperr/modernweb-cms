import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EntryValidator } from '../entries/domain/entry-validator';
import type { FieldDefinition } from '../entries/domain/field-types/field-type.strategy';
import { CreateFormDto, FormFieldDto, UpdateFormDto } from './dto/form.dto';
import {
  FORM_SUBMITTED,
  FormSubmittedEvent,
} from './events/form-submitted.event';

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    // Reused rather than reimplemented: a form field is the same shape as a
    // collection field, so the same strategies validate both.
    private readonly validator: EntryValidator,
    private readonly events: EventEmitter2,
  ) {}

  findAll(websiteId: string) {
    return this.prisma.form.findMany({
      where: { websiteId },
      include: { _count: { select: { submissions: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(websiteId: string, formId: string) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, websiteId },
    });
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  async create(websiteId: string, dto: CreateFormDto) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
    });
    if (!website) throw new NotFoundException('Website not found');
    await this.ensureSlugFree(websiteId, dto.slug);
    assertUniqueKeys(dto.fields);

    return this.prisma.form.create({
      data: {
        websiteId,
        name: dto.name,
        slug: dto.slug,
        fields: dto.fields as unknown as Prisma.InputJsonValue,
        notifyEmails: dto.notifyEmails ?? [],
        active: dto.active ?? true,
      },
    });
  }

  async update(websiteId: string, formId: string, dto: UpdateFormDto) {
    const form = await this.findOne(websiteId, formId);
    if (dto.slug && dto.slug !== form.slug) {
      await this.ensureSlugFree(websiteId, dto.slug);
    }
    if (dto.fields) assertUniqueKeys(dto.fields);

    return this.prisma.form.update({
      where: { id: formId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.fields !== undefined
          ? { fields: dto.fields as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.notifyEmails !== undefined
          ? {
              notifyEmails: dto.notifyEmails,
            }
          : {}),
      },
    });
  }

  async remove(websiteId: string, formId: string) {
    await this.findOne(websiteId, formId);
    await this.prisma.form.delete({ where: { id: formId } });
    return { deleted: true };
  }

  async submissions(
    websiteId: string,
    formId: string,
    pagination: PaginationDto,
  ) {
    await this.findOne(websiteId, formId);
    const where = { formId };
    const [items, total] = await Promise.all([
      this.prisma.formSubmission.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.formSubmission.count({ where }),
    ]);
    return paginate(items, total, pagination);
  }

  async removeSubmission(
    websiteId: string,
    formId: string,
    submissionId: string,
  ) {
    await this.findOne(websiteId, formId);
    const submission = await this.prisma.formSubmission.findFirst({
      where: { id: submissionId, formId },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    await this.prisma.formSubmission.delete({ where: { id: submissionId } });
    return { deleted: true };
  }

  /** Public path: called by the frontend, so it never trusts the payload. */
  async submit(
    websiteId: string,
    formSlug: string,
    data: Record<string, unknown>,
    meta: { ip?: string; userAgent?: string },
  ) {
    const form = await this.prisma.form.findUnique({
      where: { websiteId_slug: { websiteId, slug: formSlug } },
    });
    if (!form) throw new NotFoundException('Form not found');
    if (!form.active) {
      throw new BadRequestException('This form is no longer accepting entries');
    }

    const fields = form.fields as unknown as FieldDefinition[];
    const cleaned = this.validator.validate(fields, data);

    const submission = await this.prisma.formSubmission.create({
      data: {
        formId: form.id,
        websiteId,
        data: cleaned as Prisma.InputJsonValue,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 500),
      },
    });

    this.events.emit(
      FORM_SUBMITTED,
      new FormSubmittedEvent(
        submission.id,
        websiteId,
        form.id,
        form.name,
        (form.notifyEmails as string[]) ?? [],
        cleaned,
      ),
    );
    // The frontend only needs an acknowledgement, not the stored row.
    return { id: submission.id, submitted: true };
  }

  private async ensureSlugFree(websiteId: string, slug: string) {
    const existing = await this.prisma.form.findUnique({
      where: { websiteId_slug: { websiteId, slug } },
    });
    if (existing) {
      throw new ConflictException('Form slug already in use on this website');
    }
  }
}

/** Duplicate keys would silently drop data, so reject them at definition time. */
function assertUniqueKeys(fields: FormFieldDto[]) {
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.key)) {
      throw new BadRequestException(`Duplicate field key "${field.key}"`);
    }
    seen.add(field.key);
  }
}
