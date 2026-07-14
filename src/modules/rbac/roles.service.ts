import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.role.create({
      data: { websiteId, name: dto.name, permissions: dto.permissions },
    });
  }

  async update(websiteId: string, roleId: string, dto: UpdateRoleDto) {
    await this.findOneOrThrow(websiteId, roleId);
    return this.prisma.role.update({
      where: { id: roleId },
      data: dto,
    });
  }

  async remove(websiteId: string, roleId: string) {
    await this.findOneOrThrow(websiteId, roleId);
    const membersUsingRole = await this.prisma.websiteUser.count({
      where: { roleId },
    });
    if (membersUsingRole > 0) {
      throw new ConflictException(
        `Role is assigned to ${membersUsingRole} member(s); reassign them first`,
      );
    }
    await this.prisma.role.delete({ where: { id: roleId } });
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
