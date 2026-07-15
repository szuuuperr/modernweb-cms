import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../generated/prisma/client';

function mariaDbConfigFromUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    // MySQL 8 defaults to caching_sha2_password, which over a non-TLS socket
    // makes the driver ask the server for its RSA public key — and it refuses
    // unless this is set. Opt-in via the URL because fetching that key from an
    // unverified server is MITM-able: fine for docker-on-localhost dev, not for
    // a link you do not trust. Prod should use TLS instead.
    allowPublicKeyRetrieval:
      u.searchParams.get('allowPublicKeyRetrieval') === 'true',
  };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaMariaDb(
      mariaDbConfigFromUrl(process.env.DATABASE_URL as string),
    );
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
