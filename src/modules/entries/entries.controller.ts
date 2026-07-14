import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  CreateEntryDto,
  QueryEntriesDto,
  UpdateEntryDto,
} from './dto/entry.dto';
import { EntriesService } from './entries.service';

@ApiTags('entries')
@ApiBearerAuth()
@Controller('websites/:websiteId/collections/:collectionId/entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Get()
  @RequirePermissions('entries.read')
  findAll(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Query() query: QueryEntriesDto,
  ) {
    return this.entriesService.findAll(websiteId, collectionId, query);
  }

  @Get(':entryId')
  @RequirePermissions('entries.read')
  findOne(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.entriesService.findOne(websiteId, collectionId, entryId);
  }

  @Post()
  @RequirePermissions('entries.create')
  create(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Body() dto: CreateEntryDto,
  ) {
    return this.entriesService.create(websiteId, collectionId, dto);
  }

  @Patch(':entryId')
  @RequirePermissions('entries.update')
  update(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateEntryDto,
  ) {
    return this.entriesService.update(websiteId, collectionId, entryId, dto);
  }

  @HttpCode(200)
  @Post(':entryId/publish')
  @RequirePermissions('entries.publish')
  publish(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.entriesService.publish(websiteId, collectionId, entryId);
  }

  @HttpCode(200)
  @Post(':entryId/unpublish')
  @RequirePermissions('entries.publish')
  unpublish(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.entriesService.unpublish(websiteId, collectionId, entryId);
  }

  @Delete(':entryId')
  @RequirePermissions('entries.delete')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.entriesService.remove(websiteId, collectionId, entryId);
  }
}
