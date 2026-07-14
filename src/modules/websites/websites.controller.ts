import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RequirePlatformRole } from '../../common/decorators/require-platform-role.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import type { AuthUser } from '../../common/types/auth-user';
import { PlatformRole } from '../../generated/prisma/client';
import { CreateWebsiteDto, UpdateWebsiteDto } from './dto/create-website.dto';
import { WebsitesService } from './websites.service';

@ApiTags('websites')
@ApiBearerAuth()
@Controller('websites')
export class WebsitesController {
  constructor(private readonly websitesService: WebsitesService) {}

  @Post()
  @RequirePlatformRole(PlatformRole.PLATFORM_ADMIN)
  create(@Body() dto: CreateWebsiteDto) {
    return this.websitesService.create(dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() pagination: PaginationDto) {
    return this.websitesService.findAllFor(user, pagination);
  }

  @Get(':websiteId')
  @RequirePermissions('websites.read')
  findOne(@Param('websiteId') websiteId: string) {
    return this.websitesService.findOne(websiteId);
  }

  @Patch(':websiteId')
  @RequirePermissions('websites.update')
  update(
    @Param('websiteId') websiteId: string,
    @Body() dto: UpdateWebsiteDto,
  ) {
    return this.websitesService.update(websiteId, dto);
  }

  @Delete(':websiteId')
  @RequirePlatformRole(PlatformRole.PLATFORM_ADMIN)
  remove(@Param('websiteId') websiteId: string) {
    return this.websitesService.remove(websiteId);
  }
}
