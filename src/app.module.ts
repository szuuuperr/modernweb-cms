import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { CollectionsModule } from './modules/collections/collections.module';
import { ContentModule } from './modules/content/content.module';
import { EntriesModule } from './modules/entries/entries.module';
import { MediaModule } from './modules/media/media.module';
import { PermissionsGuard } from './modules/rbac/guards/permissions.guard';
import { PlatformRoleGuard } from './modules/rbac/guards/platform-role.guard';
import { RbacModule } from './modules/rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';
import { WebsitesModule } from './modules/websites/websites.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    RbacModule,
    WebsitesModule,
    CollectionsModule,
    EntriesModule,
    MediaModule,
    ContentModule,
  ],
  providers: [
    // Guard order matters: authenticate, then platform role, then website RBAC.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PlatformRoleGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
