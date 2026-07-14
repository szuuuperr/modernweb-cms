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
}

export interface StorageAdapter {
  save(file: UploadedFile, keyPrefix: string): Promise<StoredFile>;
  delete(storageKey: string): Promise<void>;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
