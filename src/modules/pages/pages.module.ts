import { Module } from '@nestjs/common';
import { SeoModule } from '../seo/seo.module';
import { PageEventsListener } from './events/page-events.listener';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [SeoModule],
  controllers: [PagesController],
  providers: [PagesService, PageEventsListener],
  exports: [PagesService],
})
export class PagesModule {}
