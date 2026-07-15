import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { RequestContextInterceptor } from './common/context/request-context.interceptor';
import { CacheModule } from './infrastructure/cache/cache.module';
import { MailerModule } from './infrastructure/mailer/mailer.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { FormsModule } from './modules/forms/forms.module';
import { HealthModule } from './modules/health/health.module';
import { PreviewModule } from './modules/preview/preview.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { CollectionsModule } from './modules/collections/collections.module';
import { ContentModule } from './modules/content/content.module';
import { EntriesModule } from './modules/entries/entries.module';
import { MediaModule } from './modules/media/media.module';
import { MenusModule } from './modules/menus/menus.module';
import { PagesModule } from './modules/pages/pages.module';
import { PermissionsGuard } from './modules/rbac/guards/permissions.guard';
import { PlatformRoleGuard } from './modules/rbac/guards/platform-role.guard';
import { RbacModule } from './modules/rbac/rbac.module';
import { SeoModule } from './modules/seo/seo.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { WebsitesModule } from './modules/websites/websites.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    // Applied only to the public Content API, via ContentThrottlerGuard.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.CONTENT_RATE_TTL_MS ?? 60_000),
        limit: Number(process.env.CONTENT_RATE_LIMIT ?? 120),
      },
    ]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    StorageModule,
    CacheModule,
    MailerModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RbacModule,
    WebsitesModule,
    CollectionsModule,
    EntriesModule,
    MediaModule,
    PagesModule,
    MenusModule,
    SeoModule,
    SettingsModule,
    ApiKeysModule,
    WebhooksModule,
    FormsModule,
    AnalyticsModule,
    PreviewModule,
    ContentModule,
  ],
  providers: [
    // Guard order matters: authenticate, then platform role, then website RBAC.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PlatformRoleGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Runs after the guards, so request.user is already resolved.
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
