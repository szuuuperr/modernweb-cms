import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyCreatedDto, CreateApiKeyDto } from './dto/api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('websites/:websiteId/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @RequirePermissions('apikeys.read')
  findAll(@Param('websiteId') websiteId: string) {
    return this.apiKeysService.findAll(websiteId);
  }

  @Post()
  @ApiOkResponse({ type: ApiKeyCreatedDto })
  @RequirePermissions('apikeys.manage')
  create(@Param('websiteId') websiteId: string, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(websiteId, dto);
  }

  @HttpCode(200)
  @Post(':apiKeyId/revoke')
  @RequirePermissions('apikeys.manage')
  revoke(
    @Param('websiteId') websiteId: string,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.apiKeysService.revoke(websiteId, apiKeyId);
  }

  @Delete(':apiKeyId')
  @RequirePermissions('apikeys.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('apiKeyId') apiKeyId: string,
  ) {
    return this.apiKeysService.remove(websiteId, apiKeyId);
  }
}
