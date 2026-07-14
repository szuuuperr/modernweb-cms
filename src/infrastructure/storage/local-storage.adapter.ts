import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import {
  StorageAdapter,
  StoredFile,
  UploadedFile,
} from './storage.adapter';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly uploadDir: string;
  private readonly appUrl: string;

  constructor(config: ConfigService) {
    this.uploadDir = config.get<string>('UPLOAD_DIR', 'uploads');
    this.appUrl = config.get<string>('APP_URL', 'http://localhost:3000');
  }

  async save(file: UploadedFile, keyPrefix: string): Promise<StoredFile> {
    const safeName = file.originalName
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .toLowerCase();
    const storageKey = `${keyPrefix}/${Date.now()}-${randomBytes(4).toString('hex')}-${safeName}`;
    const absolutePath = join(process.cwd(), this.uploadDir, storageKey);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);
    return { storageKey, url: `${this.appUrl}/uploads/${storageKey}` };
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = join(process.cwd(), this.uploadDir, storageKey);
    await unlink(absolutePath).catch(() => undefined);
  }
}
