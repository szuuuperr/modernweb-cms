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
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('websites/:websiteId/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.read')
  findAll(@Param('websiteId') websiteId: string) {
    return this.rolesService.findAll(websiteId);
  }

  @Post()
  @RequirePermissions('roles.manage')
  create(@Param('websiteId') websiteId: string, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(websiteId, dto);
  }

  @Patch(':roleId')
  @RequirePermissions('roles.manage')
  update(
    @Param('websiteId') websiteId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(websiteId, roleId, dto);
  }

  @Delete(':roleId')
  @RequirePermissions('roles.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rolesService.remove(websiteId, roleId);
  }
}
