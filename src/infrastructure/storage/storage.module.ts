import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryStorageAdapter } from './cloudinary-storage.adapter';
import { LocalStorageAdapter } from './local-storage.adapter';
import { STORAGE_ADAPTER } from './storage.adapter';

/**
 * Adapter pattern in practice: STORAGE_DRIVER decides the implementation and
 * nothing downstream of STORAGE_ADAPTER knows which one it got.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('STORAGE_DRIVER', 'local');
        switch (driver) {
          case 'cloudinary':
            return new CloudinaryStorageAdapter(config);
          case 'local':
            return new LocalStorageAdapter(config);
          default:
            throw new Error(
              `Unknown STORAGE_DRIVER "${driver}"; expected "local" or "cloudinary"`,
            );
        }
      },
    },
  ],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
