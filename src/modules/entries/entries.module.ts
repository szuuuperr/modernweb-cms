import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { EntryValidator } from './domain/entry-validator';
import { FieldTypeRegistry } from './domain/field-type.registry';
import { EntriesController } from './entries.controller';
import { EntriesRepository } from './entries.repository';
import { EntriesService } from './entries.service';
import { EntryEventsListener } from './events/entry-events.listener';

@Module({
  imports: [SeoModule],
  controllers: [EntriesController],
  providers: [
    EntriesService,
    EntriesRepository,
    EntryValidator,
    FieldTypeRegistry,
    EntryEventsListener,
  ],
  // EntryValidator is exported for FormsModule: form fields reuse the same
  // field-type strategies as collection entries.
  exports: [EntriesRepository, EntryValidator],
})
export class EntriesModule {}
