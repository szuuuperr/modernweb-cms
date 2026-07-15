import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/audit.dto';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('websites/:websiteId/audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** Read-only by design: the log is append-only and has no write endpoint. */
  @Get()
  @RequirePermissions('audit.read')
  findAll(
    @Param('websiteId') websiteId: string,
    @Query() query: QueryAuditDto,
  ) {
    return this.auditService.findAll(websiteId, query);
  }
}
