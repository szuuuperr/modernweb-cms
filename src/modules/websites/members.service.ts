import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AddMemberDto, UpdateMemberDto } from './dto/member.dto';

const MEMBER_INCLUDE = {
  user: { select: { id: true, email: true, name: true } },
  role: { select: { id: true, name: true } },
} as const;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.websiteUser.create({
      data: { websiteId, userId: user.id, roleId: dto.roleId },
      include: MEMBER_INCLUDE,
    });
  }

  async updateRole(websiteId: string, memberId: string, dto: UpdateMemberDto) {
    await this.findMemberOrThrow(websiteId, memberId);
    await this.ensureRoleBelongsToWebsite(websiteId, dto.roleId);
    return this.prisma.websiteUser.update({
      where: { id: memberId },
      data: { roleId: dto.roleId },
      include: MEMBER_INCLUDE,
    });
  }

  async remove(websiteId: string, memberId: string) {
    await this.findMemberOrThrow(websiteId, memberId);
    await this.prisma.websiteUser.delete({ where: { id: memberId } });
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
