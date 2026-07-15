import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUDIT_ACTION, AuditEvent } from '../../common/events/audit.event';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AddMemberDto, UpdateMemberDto } from './dto/member.dto';

const MEMBER_INCLUDE = {
  user: { select: { id: true, email: true, name: true } },
  role: { select: { id: true, name: true } },
} as const;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Granting and revoking access to a website is audit-worthy by definition. */
  private audit(
    websiteId: string,
    action: string,
    memberId: string,
    meta?: Record<string, unknown>,
  ) {
    this.events.emit(
      AUDIT_ACTION,
      new AuditEvent(websiteId, 'member', action, memberId, meta),
    );
  }

  findAll(websiteId: string) {
    return this.prisma.websiteUser.findMany({
      where: { websiteId },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async add(websiteId: string, dto: AddMemberDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new NotFoundException('No user with that email');

    await this.ensureRoleBelongsToWebsite(websiteId, dto.roleId);

    const existing = await this.prisma.websiteUser.findUnique({
      where: { userId_websiteId: { userId: user.id, websiteId } },
    });
    if (existing) throw new ConflictException('User is already a member');

    const member = await this.prisma.websiteUser.create({
      data: { websiteId, userId: user.id, roleId: dto.roleId },
      include: MEMBER_INCLUDE,
    });
    this.audit(websiteId, 'added', member.id, {
      email: user.email,
      role: member.role.name,
    });
    return member;
  }

  async updateRole(websiteId: string, memberId: string, dto: UpdateMemberDto) {
    await this.findMemberOrThrow(websiteId, memberId);
    await this.ensureRoleBelongsToWebsite(websiteId, dto.roleId);
    const member = await this.prisma.websiteUser.update({
      where: { id: memberId },
      data: { roleId: dto.roleId },
      include: MEMBER_INCLUDE,
    });
    this.audit(websiteId, 'role_changed', memberId, {
      email: member.user.email,
      role: member.role.name,
    });
    return member;
  }

  async remove(websiteId: string, memberId: string) {
    await this.findMemberOrThrow(websiteId, memberId);
    await this.prisma.websiteUser.delete({ where: { id: memberId } });
    this.audit(websiteId, 'removed', memberId);
    return { deleted: true };
  }

  private async findMemberOrThrow(websiteId: string, memberId: string) {
    const member = await this.prisma.websiteUser.findFirst({
      where: { id: memberId, websiteId },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  private async ensureRoleBelongsToWebsite(websiteId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, websiteId },
    });
    if (!role) {
      throw new NotFoundException('Role not found on this website');
    }
  }
}
