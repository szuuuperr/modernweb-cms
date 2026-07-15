import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditListener } from './audit.listener';
import { AuditService } from './audit.service';

/** Global: any module may record an audit entry without importing this. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditListener],
  exports: [AuditService],
})
export class AuditModule {}
