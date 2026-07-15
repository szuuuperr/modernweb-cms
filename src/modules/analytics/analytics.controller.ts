import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AnalyticsService } from './analytics.service';
import { QueryPageViewsDto } from './dto/analytics.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('websites/:websiteId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('page-views')
  @RequirePermissions('analytics.read')
  summary(
    @Param('websiteId') websiteId: string,
    @Query() query: QueryPageViewsDto,
  ) {
    return this.analyticsService.summary(websiteId, query);
  }
}
