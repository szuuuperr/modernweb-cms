import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PreviewController } from './preview.controller';
import { PreviewService } from './preview.service';

@Module({
  imports: [
    // Its own JwtModule registration: preview tokens are signed with the same
    // secret but carry a `scope: preview` claim and their own TTL, so they are
    // never interchangeable with access tokens.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [PreviewController],
  providers: [PreviewService],
  exports: [PreviewService],
})
export class PreviewModule {}
