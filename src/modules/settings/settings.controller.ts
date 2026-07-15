import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SettingKeyParamDto, UpsertSettingDto } from './dto/setting.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('websites/:websiteId/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions('settings.read')
  findAll(@Param('websiteId') websiteId: string) {
    return this.settingsService.findAll(websiteId);
  }

  @Get(':key')
  @RequirePermissions('settings.read')
  findOne(
    @Param('websiteId') websiteId: string,
    @Param() { key }: SettingKeyParamDto,
  ) {
    return this.settingsService.findOne(websiteId, key);
  }

  @Put(':key')
  @RequirePermissions('settings.manage')
  upsert(
    @Param('websiteId') websiteId: string,
    @Param() { key }: SettingKeyParamDto,
    @Body() dto: UpsertSettingDto,
  ) {
    return this.settingsService.upsert(websiteId, key, dto.value);
  }

  @Delete(':key')
  @RequirePermissions('settings.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param() { key }: SettingKeyParamDto,
  ) {
    return this.settingsService.remove(websiteId, key);
  }
}
