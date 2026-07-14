import { Module } from '@nestjs/common';
import { EntryValidator } from './domain/entry-validator';
import { FieldTypeRegistry } from './domain/field-type.registry';
import { EntriesController } from './entries.controller';
import { EntriesRepository } from './entries.repository';
import { EntriesService } from './entries.service';
import { EntryEventsListener } from './events/entry-events.listener';

@Module({
  controllers: [EntriesController],
  providers: [
    EntriesService,
    EntriesRepository,
    EntryValidator,
    FieldTypeRegistry,
    EntryEventsListener,
  ],
  exports: [EntriesRepository],
})
export class EntriesModule {}
