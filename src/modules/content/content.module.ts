import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { EntriesModule } from '../entries/entries.module';
import { FormsModule } from '../forms/forms.module';
import { MenusModule } from '../menus/menus.module';
import { PreviewModule } from '../preview/preview.module';
import { SeoModule } from '../seo/seo.module';
import { SettingsModule } from '../settings/settings.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { ContentCacheListener } from './events/content-cache.listener';

@Module({
  imports: [
    EntriesModule,
    SeoModule,
    MenusModule,
    SettingsModule,
    ApiKeysModule,
    FormsModule,
    AnalyticsModule,
    PreviewModule,
  ],
  controllers: [ContentController],
  providers: [ContentService, ContentCacheListener],
})
export class ContentModule {}
