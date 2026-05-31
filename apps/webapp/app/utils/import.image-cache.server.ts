/**
 * Image cache types and constants used during bulk asset imports.
 *
 * The LRU cache is keyed on the original image URL and stores the processed
 * (resized/cropped) image buffer so repeated imports of the same URL do not
 * re-download or re-process the image.
 */

import type { LRUCache } from "lru-cache";

/** Total in-memory budget for the import image cache (100 MB). */
export const MAX_CACHE_SIZE = 100 * 1024 * 1024;

/** A single cached, processed image entry. */
export type CachedImage = {
  buffer: Buffer;
  contentType: string;
  size: number;
};

/**
 * No-op placeholder — caching now happens inside storage.server.ts
 * via the internal `cacheStoredImage` helper.
 *
 * @deprecated Call uploadImageFromUrl with a cache instance instead.
 */
export function cacheOptimizedImage(
  _path: string,
  _originalUrl: string,
  _cache: LRUCache<string, CachedImage>
): Promise<CachedImage | null> {
  return Promise.resolve(null);
}
