import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CACHE_STORE } from './cache.store';
import { MemoryCacheStore } from './memory-cache.store';
import { RedisCacheStore } from './redis-cache.store';

@Global()
@Module({
  providers: [
    {
      provide: CACHE_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        const logger = new Logger('CacheModule');
        if (url) {
          logger.log('Cache store: Redis');
          return new RedisCacheStore(url);
        }
        logger.log('Cache store: in-memory (set REDIS_URL to use Redis)');
        return new MemoryCacheStore();
      },
    },
    CacheService,
  ],
  exports: [CacheService],
})
export class CacheModule {}
