import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CollectionsService } from './collections.service';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
} from './dto/create-collection.dto';

@ApiTags('collections')
@ApiBearerAuth()
@Controller('websites/:websiteId/collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @RequirePermissions('collections.read')
  findAll(@Param('websiteId') websiteId: string) {
    return this.collectionsService.findAll(websiteId);
  }

  @Get(':collectionId')
  @RequirePermissions('collections.read')
  findOne(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
  ) {
    return this.collectionsService.findOne(websiteId, collectionId);
  }

  @Post()
  @RequirePermissions('collections.manage')
  create(
    @Param('websiteId') websiteId: string,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.collectionsService.create(websiteId, dto);
  }

  @Patch(':collectionId')
  @RequirePermissions('collections.manage')
  update(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(websiteId, collectionId, dto);
  }

  @Delete(':collectionId')
  @RequirePermissions('collections.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
  ) {
    return this.collectionsService.remove(websiteId, collectionId);
  }
}
