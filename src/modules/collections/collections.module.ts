import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { FieldsController } from './fields.controller';
import { FieldsService } from './fields.service';

@Module({
  controllers: [CollectionsController, FieldsController],
  providers: [CollectionsService, FieldsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
