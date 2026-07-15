import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import { StorageAdapter, StoredFile, UploadedFile } from './storage.adapter';

/** Widths we derive for every uploaded raster image. */
const VARIANTS: { name: string; width: number }[] = [
  { name: 'thumb', width: 320 },
  { name: 'medium', width: 1024 },
];

/**
 * Cloudinary keeps the original and derives every variant on the fly at its
 * CDN edge, so nothing is resized here — we only hand out transformation URLs.
 * `f_auto` picks WebP/AVIF per browser and `q_auto` picks the compression.
 */
@Injectable()
export class CloudinaryStorageAdapter implements StorageAdapter {
  private readonly logger = new Logger(CloudinaryStorageAdapter.name);

  constructor(config: ConfigService) {
    const url = config.get<string>('CLOUDINARY_URL');
    const credentials = url
      ? parseCloudinaryUrl(url)
      : {
          cloud_name: config.get<string>('CLOUDINARY_CLOUD_NAME'),
          api_key: config.get<string>('CLOUDINARY_API_KEY'),
          api_secret: config.get<string>('CLOUDINARY_API_SECRET'),
        };

    if (
      !credentials.cloud_name ||
      !credentials.api_key ||
      !credentials.api_secret
    ) {
      throw new Error(
        'STORAGE_DRIVER=cloudinary but no credentials found. Set CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.',
      );
    }
    cloudinary.config({ ...credentials, secure: true });
  }

  async save(file: UploadedFile, keyPrefix: string): Promise<StoredFile> {
    const uploaded = await this.uploadBuffer(file, keyPrefix);
    return {
      storageKey: uploaded.public_id,
      url: uploaded.secure_url,
      variants: this.buildVariants(uploaded, file.mimeType),
    };
  }

  async delete(storageKey: string): Promise<void> {
    // The contract gives us only the key, so the resource_type is unknown here.
    // Every mime MediaService currently allows (including PDF and SVG) lands in
    // Cloudinary as `image`, so the first pass practically always wins; raw and
    // video only matter if ALLOWED_MIME_TYPES is ever widened.
    for (const resourceType of ['image', 'raw', 'video'] as const) {
      const result = await this.destroy(storageKey, resourceType);
      if (result === 'ok') return;
    }
    this.logger.warn(`Cloudinary asset not found on delete: ${storageKey}`);
  }

  private uploadBuffer(
    file: UploadedFile,
    keyPrefix: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: keyPrefix, resource_type: 'auto' },
        (error, result) => {
          if (error) return reject(new Error(error.message));
          if (!result)
            return reject(new Error('Cloudinary returned no result'));
          resolve(result);
        },
      );
      stream.end(file.buffer);
    });
  }

  private async destroy(
    publicId: string,
    resourceType: 'image' | 'raw' | 'video',
  ): Promise<string> {
    try {
      // The SDK types destroy() as `any`; go through `unknown` so nothing
      // untyped leaks past this point.
      const raw: unknown = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });
      const result = raw as { result?: string };
      return result.result ?? 'error';
    } catch {
      return 'error';
    }
  }

  /** Vector and non-image assets get no raster variants. */
  private buildVariants(
    uploaded: UploadApiResponse,
    mimeType: string,
  ): Record<string, string> | undefined {
    const isRaster =
      mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
    if (!isRaster) return undefined;

    return Object.fromEntries(
      VARIANTS.map(({ name, width }) => [
        name,
        cloudinary.url(uploaded.public_id, {
          width,
          crop: 'limit',
          fetch_format: 'auto',
          quality: 'auto',
          secure: true,
          version: uploaded.version,
        }),
      ]),
    );
  }
}

interface CloudinaryCredentials {
  cloud_name?: string;
  api_key?: string;
  api_secret?: string;
}

/**
 * Parsed here instead of letting the SDK read CLOUDINARY_URL itself.
 *
 * The SDK only reads the environment on its *first* config() call, and that
 * happens when this module is imported — before Nest's ConfigModule has loaded
 * .env. Its own parsing therefore silently yields no credentials. Doing it
 * explicitly keeps this independent of import order and global SDK state.
 */
function parseCloudinaryUrl(url: string): CloudinaryCredentials {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('CLOUDINARY_URL is not a valid URL');
  }
  if (parsed.protocol !== 'cloudinary:') {
    throw new Error(
      'CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>',
    );
  }
  return {
    cloud_name: parsed.hostname || undefined,
    api_key: decodeURIComponent(parsed.username) || undefined,
    api_secret: decodeURIComponent(parsed.password) || undefined,
  };
}
