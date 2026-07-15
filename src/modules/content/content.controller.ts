import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { API_KEY_HEADER, ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { TrackPageViewDto } from '../analytics/dto/analytics.dto';
import { SubmitFormDto } from '../forms/dto/form.dto';
import { ContentService } from './content.service';
import { PublicQueryEntriesDto } from './dto/public-query.dto';
import { ContentThrottlerGuard } from './guards/content-throttler.guard';

@ApiTags('content (public)')
@ApiHeader({
  name: API_KEY_HEADER,
  required: false,
  description: 'Required only for websites with requireApiKey enabled',
})
@ApiQuery({
  name: 'preview',
  required: false,
  description: 'Preview token; includes DRAFT content and bypasses the cache',
})
@Public()
@UseGuards(ApiKeyGuard, ContentThrottlerGuard)
@Controller('content/:websiteSlug')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('collections/:collectionSlug/entries')
  async getEntries(
    @Param('websiteSlug') websiteSlug: string,
    @Param('collectionSlug') collectionSlug: string,
    @Query() query: PublicQueryEntriesDto,
    @Query('preview') preview?: string,
  ) {
    return this.contentService.getEntries(
      websiteSlug,
      collectionSlug,
      query,
      await this.contentService.isPreview(websiteSlug, preview),
    );
  }

  @Get('collections/:collectionSlug/entries/:entryId')
  async getEntry(
    @Param('websiteSlug') websiteSlug: string,
    @Param('collectionSlug') collectionSlug: string,
    @Param('entryId') entryId: string,
    @Query('preview') preview?: string,
  ) {
    return this.contentService.getEntry(
      websiteSlug,
      collectionSlug,
      entryId,
      await this.contentService.isPreview(websiteSlug, preview),
    );
  }

  @Get('pages')
  async getPages(
    @Param('websiteSlug') websiteSlug: string,
    @Query() pagination: PaginationDto,
    @Query('preview') preview?: string,
  ) {
    return this.contentService.getPages(
      websiteSlug,
      pagination,
      await this.contentService.isPreview(websiteSlug, preview),
    );
  }

  @Get('pages/:slug')
  async getPage(
    @Param('websiteSlug') websiteSlug: string,
    @Param('slug') slug: string,
    @Query('preview') preview?: string,
  ) {
    return this.contentService.getPage(
      websiteSlug,
      slug,
      await this.contentService.isPreview(websiteSlug, preview),
    );
  }

  @Get('menus/:menuSlug')
  getMenu(
    @Param('websiteSlug') websiteSlug: string,
    @Param('menuSlug') menuSlug: string,
  ) {
    return this.contentService.getMenu(websiteSlug, menuSlug);
  }

  @Get('settings')
  getSettings(@Param('websiteSlug') websiteSlug: string) {
    return this.contentService.getSettings(websiteSlug);
  }

  @Get('seo/defaults')
  getSeoDefaults(@Param('websiteSlug') websiteSlug: string) {
    return this.contentService.getSeoDefaults(websiteSlug);
  }

  @HttpCode(200)
  @Post('forms/:formSlug/submit')
  submitForm(
    @Param('websiteSlug') websiteSlug: string,
    @Param('formSlug') formSlug: string,
    @Body() dto: SubmitFormDto,
    @Req() request: Request,
  ) {
    return this.contentService.submitForm(websiteSlug, formSlug, dto.data, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @HttpCode(202)
  @Post('analytics/page-view')
  trackPageView(
    @Param('websiteSlug') websiteSlug: string,
    @Body() dto: TrackPageViewDto,
  ) {
    return this.contentService.trackPageView(websiteSlug, dto.path);
  }
}
