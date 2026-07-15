import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUDIT_ACTION, AuditEvent } from '../../common/events/audit.event';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AddMemberDto, UpdateMemberDto } from './dto/member.dto';

const MEMBER_INCLUDE = {
  // platformRole is exposed so the admin panel can mark platform admins: their
  // access comes from the platform role, not from this website's role, and
  // editing that role changes nothing. Without it the members list would imply
  // a power the row does not actually carry.
  user: {
    select: { id: true, email: true, name: true, platformRole: true },
  },
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

  async updateRole(
    websiteId: string,
    memberId: string,
    dto: UpdateMemberDto,
    actorId: string,
  ) {
    const existing = await this.findMemberOrThrow(websiteId, memberId);
    this.ensureNotSelf(existing.userId, actorId);
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

  async remove(websiteId: string, memberId: string, actorId: string) {
    const existing = await this.findMemberOrThrow(websiteId, memberId);
    this.ensureNotSelf(existing.userId, actorId);
    await this.prisma.websiteUser.delete({ where: { id: memberId } });
    this.audit(websiteId, 'removed', memberId);
    return { deleted: true };
  }

  /**
   * Demoting or removing yourself is a one-way door: the moment the role loses
   * members.manage, undoing it needs someone else. An Owner could lock the last
   * owner out of a website with one click and only a platform admin could
   * rescue them — so the change must come from another member who still holds
   * members.manage.
   *
   * The actor is passed in rather than read from the request context: an
   * authorization rule that depends on implicit state silently allows the call
   * wherever that state is absent (seed, cron), which is exactly where a
   * mistake would go unnoticed.
   */
  private ensureNotSelf(memberUserId: string, actorId: string) {
    if (memberUserId === actorId) {
      throw new BadRequestException(
        'You cannot change or remove your own membership; ask another member with members.manage',
      );
    }
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
