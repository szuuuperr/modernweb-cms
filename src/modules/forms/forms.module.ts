import { Module } from '@nestjs/common';
import { EntriesModule } from '../entries/entries.module';
import { FormNotificationListener } from './events/form-notification.listener';
import { FormsController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  // For EntryValidator + FieldTypeRegistry, reused for form field validation.
  imports: [EntriesModule],
  controllers: [FormsController],
  providers: [FormsService, FormNotificationListener],
  exports: [FormsService],
})
export class FormsModule {}
