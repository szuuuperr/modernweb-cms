import { Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PreviewService } from './preview.service';

@ApiTags('preview')
@ApiBearerAuth()
@Controller('websites/:websiteId/preview-tokens')
export class PreviewController {
  constructor(private readonly previewService: PreviewService) {}

  @HttpCode(200)
  @Post()
  @RequirePermissions('preview.create')
  issue(@Param('websiteId') websiteId: string) {
    return this.previewService.issue(websiteId);
  }
}
