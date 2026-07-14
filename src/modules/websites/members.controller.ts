import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AddMemberDto, UpdateMemberDto } from './dto/member.dto';
import { MembersService } from './members.service';

@ApiTags('members')
@ApiBearerAuth()
@Controller('websites/:websiteId/members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @RequirePermissions('members.read')
  findAll(@Param('websiteId') websiteId: string) {
    return this.membersService.findAll(websiteId);
  }

  @Post()
  @RequirePermissions('members.manage')
  add(@Param('websiteId') websiteId: string, @Body() dto: AddMemberDto) {
    return this.membersService.add(websiteId, dto);
  }

  @Patch(':memberId')
  @RequirePermissions('members.manage')
  updateRole(
    @Param('websiteId') websiteId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.updateRole(websiteId, memberId, dto);
  }

  @Delete(':memberId')
  @RequirePermissions('members.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.membersService.remove(websiteId, memberId);
  }
}
