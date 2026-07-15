/**
 * Adapter pattern: MediaService only depends on this contract.
 * Swap LocalStorageAdapter for MinIO/Cloudinary later without touching callers.
 */
export interface UploadedFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface StoredFile {
  storageKey: string;
  url: string;
  /**
   * Pre-derived variant URLs keyed by name (e.g. { thumb, medium }).
   * Adapters that cannot derive variants simply omit this, which keeps
   * MediaService free of any provider-specific knowledge.
   */
  variants?: Record<string, string>;
}

export interface StorageAdapter {
  save(file: UploadedFile, keyPrefix: string): Promise<StoredFile>;
  delete(storageKey: string): Promise<void>;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
