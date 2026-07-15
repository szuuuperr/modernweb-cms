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
import { CreatePageDto, QueryPagesDto, UpdatePageDto } from './dto/page.dto';
import { PagesService } from './pages.service';

@ApiTags('pages')
@ApiBearerAuth()
@Controller('websites/:websiteId/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  @RequirePermissions('pages.read')
  findAll(
    @Param('websiteId') websiteId: string,
    @Query() query: QueryPagesDto,
  ) {
    return this.pagesService.findAll(websiteId, query);
  }

  @Get(':pageId')
  @RequirePermissions('pages.read')
  findOne(
    @Param('websiteId') websiteId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.pagesService.findOne(websiteId, pageId);
  }

  @Post()
  @RequirePermissions('pages.create')
  create(@Param('websiteId') websiteId: string, @Body() dto: CreatePageDto) {
    return this.pagesService.create(websiteId, dto);
  }

  @Patch(':pageId')
  @RequirePermissions('pages.update')
  update(
    @Param('websiteId') websiteId: string,
    @Param('pageId') pageId: string,
    @Body() dto: UpdatePageDto,
  ) {
    return this.pagesService.update(websiteId, pageId, dto);
  }

  @HttpCode(200)
  @Post(':pageId/publish')
  @RequirePermissions('pages.publish')
  publish(
    @Param('websiteId') websiteId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.pagesService.publish(websiteId, pageId);
  }

  @HttpCode(200)
  @Post(':pageId/unpublish')
  @RequirePermissions('pages.publish')
  unpublish(
    @Param('websiteId') websiteId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.pagesService.unpublish(websiteId, pageId);
  }

  @Delete(':pageId')
  @RequirePermissions('pages.delete')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.pagesService.remove(websiteId, pageId);
  }
}
