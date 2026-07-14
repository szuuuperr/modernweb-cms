import { Module } from '@nestjs/common';
import { EntriesModule } from '../entries/entries.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  imports: [EntriesModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
