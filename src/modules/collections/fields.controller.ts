import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CreateFieldDto, UpdateFieldDto } from './dto/create-field.dto';
import { FieldsService } from './fields.service';

@ApiTags('fields')
@ApiBearerAuth()
@Controller('websites/:websiteId/collections/:collectionId/fields')
export class FieldsController {
  constructor(private readonly fieldsService: FieldsService) {}

  @Post()
  @RequirePermissions('collections.manage')
  create(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Body() dto: CreateFieldDto,
  ) {
    return this.fieldsService.create(websiteId, collectionId, dto);
  }

  @Patch(':fieldId')
  @RequirePermissions('collections.manage')
  update(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Param('fieldId') fieldId: string,
    @Body() dto: UpdateFieldDto,
  ) {
    return this.fieldsService.update(websiteId, collectionId, fieldId, dto);
  }

  @Delete(':fieldId')
  @RequirePermissions('collections.manage')
  remove(
    @Param('websiteId') websiteId: string,
    @Param('collectionId') collectionId: string,
    @Param('fieldId') fieldId: string,
  ) {
    return this.fieldsService.remove(websiteId, collectionId, fieldId);
  }
}
