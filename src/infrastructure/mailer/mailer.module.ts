import { Global, Module } from '@nestjs/common';
import { MAILER_ADAPTER } from './mailer.adapter';
import { SmtpMailerAdapter } from './smtp-mailer.adapter';

@Global()
@Module({
  providers: [{ provide: MAILER_ADAPTER, useClass: SmtpMailerAdapter }],
  exports: [MAILER_ADAPTER],
})
export class MailerModule {}
