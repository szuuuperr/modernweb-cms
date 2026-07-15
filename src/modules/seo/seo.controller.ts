import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SeoTarget } from '../../generated/prisma/client';
import { UpsertSeoDefaultsDto, UpsertSeoDto } from './dto/seo.dto';
import { SeoService } from './seo.service';

@ApiTags('seo')
@ApiBearerAuth()
@Controller('websites/:websiteId/seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get('defaults')
  @RequirePermissions('seo.read')
  getDefaults(@Param('websiteId') websiteId: string) {
    return this.seoService.getDefaults(websiteId);
  }

  @Put('defaults')
  @RequirePermissions('seo.manage')
  upsertDefaults(
    @Param('websiteId') websiteId: string,
    @Body() dto: UpsertSeoDefaultsDto,
  ) {
    return this.seoService.upsertDefaults(websiteId, dto);
  }

  @Get(':targetType/:targetId')
  @RequirePermissions('seo.read')
  get(
    @Param('websiteId') websiteId: string,
    @Param('targetType', new ParseEnumPipe(SeoTarget)) targetType: SeoTarget,
    @Param('targetId') targetId: string,
  ) {
    return this.seoService.get(websiteId, targetType, targetId);
  }

  @Put(':targetType/:targetId')
  @RequirePermissions('seo.manage')
  upsert(
    @Param('websiteId') websiteId: string,
    @Param('targetType', new ParseEnumPipe(SeoTarget)) targetType: SeoTarget,
    @Param('targetId') targetId: string,
    @Body() dto: UpsertSeoDto,
  ) {
    return this.seoService.upsert(websiteId, targetType, targetId, dto);
  }

  @Delete(':targetType/:targetId')
  @RequirePermissions('seo.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('targetType', new ParseEnumPipe(SeoTarget)) targetType: SeoTarget,
    @Param('targetId') targetId: string,
  ) {
    return this.seoService.remove(websiteId, targetType, targetId);
  }
}
