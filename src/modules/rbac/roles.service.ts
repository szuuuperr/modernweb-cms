import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUDIT_ACTION, AuditEvent } from '../../common/events/audit.event';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Who changed which permissions is the whole point of an audit log. */
  private audit(
    websiteId: string,
    action: string,
    roleId: string,
    meta?: Record<string, unknown>,
  ) {
    this.events.emit(
      AUDIT_ACTION,
      new AuditEvent(websiteId, 'role', action, roleId, meta),
    );
  }

  findAll(websiteId: string) {
    return this.prisma.role.findMany({
      where: { websiteId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(websiteId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { websiteId_name: { websiteId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists`);
    }
    const role = await this.prisma.role.create({
      data: { websiteId, name: dto.name, permissions: dto.permissions },
    });
    this.audit(websiteId, 'created', role.id, {
      name: role.name,
      permissions: dto.permissions,
    });
    return role;
  }

  async update(websiteId: string, roleId: string, dto: UpdateRoleDto) {
    const before = await this.findOneOrThrow(websiteId, roleId);
    const role = await this.prisma.role.update({
      where: { id: roleId },
      data: dto,
    });
    this.audit(websiteId, 'updated', roleId, {
      name: role.name,
      permissionsBefore: before.permissions,
      permissionsAfter: role.permissions,
    });
    return role;
  }

  async remove(websiteId: string, roleId: string) {
    const role = await this.findOneOrThrow(websiteId, roleId);
    const membersUsingRole = await this.prisma.websiteUser.count({
      where: { roleId },
    });
    if (membersUsingRole > 0) {
      throw new ConflictException(
        `Role is assigned to ${membersUsingRole} member(s); reassign them first`,
      );
    }
    await this.prisma.role.delete({ where: { id: roleId } });
    this.audit(websiteId, 'deleted', roleId, { name: role.name });
    return { deleted: true };
  }

  private async findOneOrThrow(websiteId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, websiteId },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }
}
