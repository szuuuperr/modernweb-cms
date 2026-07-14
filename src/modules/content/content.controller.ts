import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ContentService } from './content.service';
import { PublicQueryEntriesDto } from './dto/public-query.dto';

@ApiTags('content (public)')
@Public()
@Controller('content/:websiteSlug/collections/:collectionSlug/entries')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get()
  getEntries(
    @Param('websiteSlug') websiteSlug: string,
    @Param('collectionSlug') collectionSlug: string,
    @Query() query: PublicQueryEntriesDto,
  ) {
    return this.contentService.getEntries(websiteSlug, collectionSlug, query);
  }

  @Get(':entryId')
  getEntry(
    @Param('websiteSlug') websiteSlug: string,
    @Param('collectionSlug') collectionSlug: string,
    @Param('entryId') entryId: string,
  ) {
    return this.contentService.getEntry(websiteSlug, collectionSlug, entryId);
  }
}
