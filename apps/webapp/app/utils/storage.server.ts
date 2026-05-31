/**
 * File Storage Abstraction
 *
 * Supports two storage drivers selected via the STORAGE_DRIVER environment variable:
 * - "local" (default): files written to UPLOAD_DIR, served at /uploads/* by the Hono server
 * - "s3": files stored in an S3-compatible bucket (AWS S3, MinIO, etc.)
 *
 * Public interface matches the original Supabase storage implementation so all
 * call sites work without modification.
 *
 * @see {@link file://../../../server/index.ts} - Hono static-file handler for local storage
 */

import { createHmac } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  MaxFileSizeExceededError,
  parseFormData,
} from "@remix-run/form-data-parser";
import type { LRUCache } from "lru-cache";
import type { ResizeOptions } from "sharp";

import {
  ASSET_MAX_IMAGE_UPLOAD_SIZE,
  DEFAULT_MAX_IMAGE_UPLOAD_SIZE,
  PUBLIC_BUCKET,
} from "./constants";
import { cropImage } from "./crop-image";
import { delay } from "./delay";
import { getEnv, SERVER_URL, SESSION_SECRET } from "./env";
import type { AdditionalData, ErrorLabel } from "./error";
import { isLikeShelfError, ShelfError } from "./error";
import { id } from "./id/id.server";
import { detectImageFormat } from "./image-format.server";
import type { CachedImage } from "./import.image-cache.server";
import { Logger } from "./logger";

const label: ErrorLabel = "File storage";

// ---------------------------------------------------------------------------
// Driver configuration
// ---------------------------------------------------------------------------

/** Active storage driver. Set STORAGE_DRIVER=s3 to use S3-compatible storage. */
export const STORAGE_DRIVER =
  getEnv("STORAGE_DRIVER", { isRequired: false, isSecret: false }) || "local";

/** Root directory for local file storage (only used when STORAGE_DRIVER=local). */
export const UPLOAD_DIR =
  getEnv("UPLOAD_DIR", { isRequired: false, isSecret: false }) ||
  "/data/uploads";

const isLocal = STORAGE_DRIVER !== "s3";

// ---------------------------------------------------------------------------
// S3 client (lazy — only initialised when STORAGE_DRIVER=s3)
// ---------------------------------------------------------------------------

let _s3: { client: S3Client; bucket: string; publicUrl: string } | null = null;

/** Returns the lazily-initialised S3 configuration. Throws if env vars are missing. */
function getS3(): { client: S3Client; bucket: string; publicUrl: string } {
  if (_s3) return _s3;

  const s3Config = {
    client: new S3Client({
      endpoint: getEnv("S3_ENDPOINT", { isRequired: false }) || undefined,
      region: getEnv("S3_REGION", { isRequired: false }) || "us-east-1",
      credentials: {
        accessKeyId: getEnv("S3_ACCESS_KEY_ID") as string,
        secretAccessKey: getEnv("S3_SECRET_ACCESS_KEY") as string,
      },
      forcePathStyle:
        getEnv("S3_FORCE_PATH_STYLE", { isRequired: false }) === "true",
    }),
    bucket: getEnv("S3_BUCKET") as string,
    publicUrl: (getEnv("S3_PUBLIC_URL", { isRequired: false }) || "").replace(
      /\/+$/,
      ""
    ),
  };
  _s3 = s3Config;
  return s3Config;
}

// ---------------------------------------------------------------------------
// Local storage helpers
// ---------------------------------------------------------------------------

/** Absolute filesystem path for a stored file. */
function localFilePath(bucketName: string, filename: string): string {
  return path.join(UPLOAD_DIR, bucketName, filename);
}

/** Public URL for a local file (served by the Hono /uploads/* handler). */
function localFileUrl(bucketName: string, filename: string): string {
  return `${SERVER_URL}/uploads/${bucketName}/${filename}`;
}

/** Signed TTL (seconds) — 72 h to match the legacy Supabase signed URL TTL. */
const SIGNED_URL_TTL_SECONDS = 3 * 24 * 60 * 60;

/** Computes the HMAC-SHA256 signature for a local signed URL. */
function signLocalUrl(
  bucketName: string,
  filename: string,
  exp: number
): string {
  return createHmac("sha256", SESSION_SECRET)
    .update(`${bucketName}/${filename}|${exp}`)
    .digest("hex");
}

/**
 * Validates the ?exp and ?sig query parameters on a local-storage signed URL.
 * Returns true only when the signature is correct and the URL has not expired.
 */
export function verifyLocalSignedUrl(
  bucketName: string,
  filename: string,
  sig: string,
  exp: string
): boolean {
  const expNum = Number(exp);
  if (!expNum || Date.now() > expNum * 1000) return false;

  const expected = signLocalUrl(bucketName, filename, expNum);
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");

  if (sigBuf.length !== expBuf.length) return false;

  // Constant-time comparison to prevent timing attacks
  let diff = 0;
  for (let i = 0; i < sigBuf.length; i++) {
    diff |= sigBuf[i] ^ expBuf[i];
  }

  return diff === 0;
}

/** Creates all intermediate directories for the given file path. */
function ensureDir(filePath: string): void {
  fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
}

// ---------------------------------------------------------------------------
// Path extraction — works for both local and S3 URLs
// ---------------------------------------------------------------------------

/**
 * Extracts the relative file path within a bucket from a storage URL.
 * Handles local (/uploads/{bucket}/{path}) and S3 ({publicUrl}/{bucket}/{path}) URLs.
 * Query parameters (signed-URL tokens) are stripped before extraction.
 */
function extractPathFromUrl(url: string, bucketName: string): string | null {
  const clean = url.split("?")[0];
  const marker = `/${bucketName}/`;
  const idx = clean.indexOf(marker);
  if (idx === -1) return null;
  return clean.substring(idx + marker.length);
}

// ---------------------------------------------------------------------------
// Core public API
// ---------------------------------------------------------------------------

/**
 * Returns a public URL for a file.
 *
 * For "local" driver: `{SERVER_URL}/uploads/{bucketName}/{filename}`
 * For "s3" driver: `{S3_PUBLIC_URL}/{bucketName}/{filename}`
 *
 * Use this for buckets that are intended to be publicly accessible
 * (profile-pictures, files). For private asset images use createSignedUrl().
 */
export function getPublicFileURL({
  filename,
  bucketName = "profile-pictures",
}: {
  filename: string;
  bucketName?: string;
}): string {
  try {
    if (isLocal) {
      return localFileUrl(bucketName, filename);
    }

    const { publicUrl, bucket } = getS3();
    const baseUrl = publicUrl || `https://${bucket}.s3.amazonaws.com`;
    return `${baseUrl}/${bucketName}/${filename}`;
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: "Failed to get public file URL",
      additionalData: { filename, bucketName },
      label,
    });
  }
}

/**
 * Creates a time-limited signed URL (72 h TTL) for a private file.
 *
 * For "local" driver: appends ?exp={unix_seconds}&sig={hmac} to the file URL.
 * For "s3" driver: uses the AWS SDK presigned URL mechanism.
 */
export async function createSignedUrl({
  filename,
  bucketName = "assets",
}: {
  filename: string;
  bucketName?: string;
}): Promise<string> {
  const normalizedFilename = filename.startsWith("/")
    ? filename.substring(1)
    : filename;

  try {
    if (isLocal) {
      const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
      const sig = signLocalUrl(bucketName, normalizedFilename, exp);
      return `${localFileUrl(
        bucketName,
        normalizedFilename
      )}?exp=${exp}&sig=${sig}`;
    }

    const { client, bucket } = getS3();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: `${bucketName}/${normalizedFilename}`,
    });

    return await getS3SignedUrl(client, command, {
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  } catch (cause) {
    if (isLikeShelfError(cause)) throw cause;

    throw new ShelfError({
      cause,
      message:
        "Something went wrong while creating a signed URL. Please try again. If the issue persists contact support.",
      additionalData: { filename: normalizedFilename, bucketName },
      label,
    });
  }
}

/** Options for file upload operations. */
export interface UploadOptions {
  bucketName: string;
  filename: string;
  contentType: string;
  resizeOptions?: ResizeOptions;
  upsert?: boolean;
}

/**
 * Uploads a file to storage after optional image cropping/resizing.
 *
 * When generateThumbnail is true, also uploads a square thumbnail and returns
 * `{ originalPath, thumbnailPath }` instead of a plain string path.
 *
 * @returns The stored file path (relative to bucket root), or an object with
 *   originalPath and thumbnailPath when a thumbnail is generated.
 */
export async function uploadFile(
  fileData: AsyncIterable<Uint8Array>,
  {
    filename,
    contentType,
    bucketName,
    resizeOptions,
    generateThumbnail = false,
    thumbnailSize = 108,
    upsert = false,
  }: UploadOptions & {
    generateThumbnail?: boolean;
    thumbnailSize?: number;
    upsert?: boolean;
  }
): Promise<string | { originalPath: string; thumbnailPath: string }> {
  try {
    const file = await cropImage(fileData, resizeOptions);

    const originalPath = await storeBuffer(
      Buffer.from(file),
      bucketName,
      filename,
      contentType,
      upsert
    );

    if (!generateThumbnail) {
      return originalPath;
    }

    const thumbFilename = filename.includes(".")
      ? filename.replace(/(\.[^.]+)$/, "-thumbnail$1")
      : `${filename}-thumbnail`;

    const thumbnailBuffer = await cropImage(
      (async function* () {
        await Promise.resolve();
        yield new Uint8Array(file);
      })(),
      {
        width: thumbnailSize,
        height: thumbnailSize,
        fit: "cover",
        withoutEnlargement: true,
      }
    );

    const thumbnailPath = await storeBuffer(
      Buffer.from(thumbnailBuffer),
      bucketName,
      thumbFilename,
      contentType,
      true
    );

    return { originalPath, thumbnailPath };
  } catch (cause) {
    const isShelfError = isLikeShelfError(cause);

    throw new ShelfError({
      cause,
      message: isShelfError
        ? cause.message
        : "Something went wrong while uploading the file. Please try again or contact support.",
      additionalData: { filename, contentType, bucketName },
      label,
      shouldBeCaptured: isShelfError ? cause.shouldBeCaptured : undefined,
    });
  }
}

/**
 * Writes a buffer to storage and returns the stored filename (relative path within bucket).
 * Used internally by uploadFile and uploadImageFromUrl.
 */
async function storeBuffer(
  buffer: Buffer,
  bucketName: string,
  filename: string,
  contentType: string,
  upsert = false
): Promise<string> {
  if (isLocal) {
    const filePath = localFilePath(bucketName, filename);
    ensureDir(filePath);

    if (!upsert) {
      try {
        await fs.access(filePath);
        throw new ShelfError({
          cause: null,
          message: `File already exists: ${filename}`,
          additionalData: { filename, bucketName },
          label,
        });
      } catch (e) {
        // access() throws ENOENT when file doesn't exist — that's the normal case
        if (isLikeShelfError(e)) throw e;
      }
    }

    await fs.writeFile(filePath, buffer);
    return filename;
  }

  const { client, bucket } = getS3();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${bucketName}/${filename}`,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return filename;
}

/**
 * Parses a multipart form submission, uploads any image files to storage,
 * and returns the FormData with file fields replaced by their storage paths.
 */
export async function parseFileFormData({
  request,
  newFileName,
  bucketName = "profile-pictures",
  resizeOptions,
  generateThumbnail = false,
  thumbnailSize = 108,
  maxFileSize = DEFAULT_MAX_IMAGE_UPLOAD_SIZE,
}: {
  request: Request;
  newFileName: string;
  bucketName?: string;
  resizeOptions?: ResizeOptions;
  generateThumbnail?: boolean;
  thumbnailSize?: number;
  maxFileSize?: number;
}) {
  try {
    const uploadHandler = async (upload: any) => {
      const file = upload?.file ?? upload;
      const mimeType =
        upload?.type ?? upload?.contentType ?? file?.type ?? undefined;
      const originalName =
        upload?.name ?? upload?.filename ?? file?.name ?? undefined;

      if (mimeType && !mimeType.includes("image")) {
        return undefined;
      }

      if (!file) {
        return undefined;
      }

      const fileStream = await normalizeToAsyncIterable(file);

      if (!fileStream) {
        return undefined;
      }

      const extension = originalName?.includes(".")
        ? originalName.split(".").pop()
        : undefined;
      const targetFilename = extension
        ? `${newFileName}.${extension}`
        : newFileName;

      const uploadedFilePaths = await uploadFile(fileStream, {
        filename: targetFilename,
        contentType: mimeType ?? "application/octet-stream",
        bucketName,
        resizeOptions,
        generateThumbnail,
        thumbnailSize,
      });

      if (typeof uploadedFilePaths === "string") {
        return uploadedFilePaths;
      }

      if (generateThumbnail) {
        return JSON.stringify(uploadedFilePaths);
      }

      return (uploadedFilePaths as { originalPath: string }).originalPath;
    };

    const formData = await parseFormData(
      request,
      { maxFileSize },
      uploadHandler
    );

    return formData;
  } catch (cause) {
    const sizeLimitError = getMaxFileSizeExceededError(cause);

    if (sizeLimitError) {
      throw new ShelfError({
        cause,
        title: "File too large",
        message: `Image file size exceeds maximum allowed size of ${
          maxFileSize / (1024 * 1024)
        }MB`,
        additionalData: { maxFileSize },
        label,
        shouldBeCaptured: false,
      });
    }

    const nestedShelfError = findShelfErrorInCause(cause);

    throw new ShelfError({
      cause,
      message: nestedShelfError
        ? nestedShelfError.message
        : "Something went wrong while uploading the file. Please try again or contact support.",
      title: nestedShelfError?.title,
      label,
      shouldBeCaptured: nestedShelfError?.shouldBeCaptured,
    });
  }
}

/**
 * Downloads an image from a URL, processes it, and uploads it to storage.
 * Returns the stored file path, or null if the download or upload fails.
 *
 * Implements a simple two-attempt retry with a 1 s delay between attempts.
 * Uses the optional LRU cache to skip repeated downloads of the same URL.
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  { filename, contentType, bucketName, resizeOptions }: UploadOptions,
  cache?: LRUCache<string, CachedImage>
): Promise<string | null> {
  try {
    let buffer: Buffer;
    let actualContentType: string;

    if (cache) {
      const cached = cache.get(imageUrl);
      if (cached) {
        buffer = cached.buffer;
        actualContentType = cached.contentType;

        const storedPath = await storeBuffer(
          buffer,
          bucketName,
          filename,
          actualContentType,
          true
        );

        return storedPath;
      }
    }

    let response: Response | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await fetch(imageUrl);

        if (response.ok) {
          break;
        } else {
          const fetchError = new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );

          if (attempt === 2) {
            Logger.error(
              new ShelfError({
                cause: fetchError,
                message: "Failed to fetch image from URL after 2 attempts",
                additionalData: {
                  imageUrl,
                  status: response.status,
                  attempts: 2,
                },
                label,
                shouldBeCaptured: false,
              })
            );
            return null;
          }

          await delay(1000);
        }
      } catch (cause) {
        if (attempt === 2) {
          Logger.error(
            new ShelfError({
              cause,
              message: "Failed to fetch image from URL after 2 attempts",
              additionalData: { imageUrl, attempts: 2 },
              label,
              shouldBeCaptured: false,
            })
          );
          return null;
        }

        await delay(1000);
      }
    }

    if (!response) {
      Logger.error(
        new ShelfError({
          cause: null,
          message: "Unexpected null response after retry loop",
          additionalData: { imageUrl },
          label,
          shouldBeCaptured: false,
        })
      );
      return null;
    }

    actualContentType = response.headers.get("content-type") || contentType;

    const imageBlob = await response.blob();
    buffer = Buffer.from(await imageBlob.arrayBuffer());

    const detectedImageType = detectImageFormat(buffer);

    if (!actualContentType?.startsWith("image/") && !detectedImageType) {
      throw new ShelfError({
        cause: null,
        message: "URL does not point to a valid image",
        additionalData: { imageUrl, contentType: actualContentType },
        label,
        shouldBeCaptured: false,
      });
    }

    if (detectedImageType && !actualContentType?.startsWith("image/")) {
      actualContentType = detectedImageType;
    }

    if (imageBlob.size > ASSET_MAX_IMAGE_UPLOAD_SIZE) {
      throw new ShelfError({
        cause: null,
        message: `Image file size exceeds maximum allowed size of ${
          ASSET_MAX_IMAGE_UPLOAD_SIZE / (1024 * 1024)
        }MB`,
        additionalData: { imageUrl, size: imageBlob.size },
        label,
        shouldBeCaptured: false,
      });
    }

    const processedBuffer = await cropImage(
      (async function* () {
        await Promise.resolve();
        yield new Uint8Array(buffer);
      })(),
      resizeOptions
    );

    const storedPath = await storeBuffer(
      Buffer.from(processedBuffer),
      bucketName,
      filename,
      actualContentType,
      true
    );

    if (cache && storedPath) {
      await cacheStoredImage(storedPath, bucketName, imageUrl, cache);
    }

    return storedPath;
  } catch (cause) {
    const isShelfError = isLikeShelfError(cause);

    Logger.error(
      new ShelfError({
        cause,
        message: isShelfError
          ? cause.message
          : "Failed to process and upload image from URL",
        additionalData: { imageUrl, filename, contentType, bucketName },
        label,
        shouldBeCaptured: isShelfError ? cause.shouldBeCaptured : true,
      })
    );

    return null;
  }
}

/** Reads the just-uploaded file back into the LRU cache (local or S3). */
async function cacheStoredImage(
  filePath: string,
  bucketName: string,
  originalUrl: string,
  cache: LRUCache<string, CachedImage>
): Promise<void> {
  try {
    let buffer: Buffer;
    let cachedContentType = "image/jpeg";

    if (isLocal) {
      buffer = await fs.readFile(localFilePath(bucketName, filePath));
    } else {
      const { client, bucket } = getS3();
      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: `${bucketName}/${filePath}`,
        })
      );

      if (!response.Body) return;
      const chunks: Uint8Array[] = [];

      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      buffer = Buffer.concat(chunks);
      cachedContentType = response.ContentType ?? cachedContentType;
    }

    const image: CachedImage = {
      buffer,
      contentType: cachedContentType,
      size: buffer.length,
    };

    if (image.size <= MAX_CACHE_SIZE - (cache.size || 0)) {
      cache.set(originalUrl, image);
    }
  } catch (cause) {
    Logger.error(
      new ShelfError({
        cause,
        message: "Failed to cache stored image",
        additionalData: { filePath, bucketName },
        label: "Image Cache",
      })
    );
  }
}

/** Re-export so import.image-cache.server.ts callers still compile. */
export const MAX_CACHE_SIZE = 100 * 1024 * 1024;

/**
 * Reads a stored file into a Buffer.
 * Used by asset duplication to copy images without a round-trip through HTTP.
 */
export async function readStorageFile(
  bucketName: string,
  filePath: string
): Promise<Buffer> {
  if (isLocal) {
    return fs.readFile(localFilePath(bucketName, filePath));
  }

  const { client, bucket } = getS3();
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: `${bucketName}/${filePath}` })
  );

  if (!response.Body) {
    throw new ShelfError({
      cause: null,
      message: "S3 returned an empty response body",
      additionalData: { bucketName, filePath },
      label,
    });
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Lists file names (without directory prefix) inside a storage directory path.
 * Used by asset duplication to find and prune stale image variants.
 */
export async function listStorageFiles(
  bucketName: string,
  dirPath: string
): Promise<string[]> {
  if (isLocal) {
    const dir = path.join(UPLOAD_DIR, bucketName, dirPath);
    try {
      return await fs.readdir(dir);
    } catch (e: any) {
      if (e?.code === "ENOENT") return [];
      throw e;
    }
  }

  const { client, bucket } = getS3();
  const prefix = `${bucketName}/${dirPath}/`;
  const response = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
  );

  return (response.Contents ?? [])
    .map((obj) => (obj.Key ?? "").replace(prefix, ""))
    .filter(Boolean);
}

/**
 * Writes a Buffer directly to storage (upsert).
 * Used by asset duplication to store a copied image buffer.
 */
export async function writeStorageFile(
  bucketName: string,
  filePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  return storeBuffer(buffer, bucketName, filePath, contentType, true);
}

/**
 * Deletes a single file from storage by its relative path within a bucket.
 * Swallows ENOENT (file already gone) so callers don't need to guard.
 */
export async function deleteStorageFile(
  bucketName: string,
  relPath: string
): Promise<void> {
  return deleteStoredFile(bucketName, relPath);
}

/**
 * Deletes a profile picture from storage.
 * The URL must contain the bucket name path segment — invalid URLs are logged and skipped.
 * The URL must contain the bucket name path segment — invalid URLs are logged and skipped.
 */
export async function deleteProfilePicture({
  url,
  bucketName = "profile-pictures",
}: {
  url: string;
  bucketName?: string;
}) {
  try {
    if (!url || !url.includes(`/${bucketName}/`)) {
      throw new ShelfError({
        cause: null,
        message: "Invalid file URL",
        additionalData: { url },
        label,
      });
    }

    const relPath = extractPathFromUrl(url, bucketName);

    if (!relPath) {
      throw new ShelfError({
        cause: null,
        message: "Cannot extract the image path from the URL",
        additionalData: { url, bucketName },
        label,
      });
    }

    await deleteStoredFile(bucketName, relPath);
  } catch (cause) {
    Logger.error(
      new ShelfError({
        cause,
        message: "Failed to delete the profile picture",
        additionalData: { url, bucketName },
        label,
      })
    );
  }
}

/**
 * Deletes an asset image from storage.
 * Logs and swallows errors so a missing image does not block asset mutations.
 */
export async function deleteAssetImage({
  url,
  bucketName,
}: {
  url: string;
  bucketName: string;
}) {
  try {
    const relPath = extractPathFromUrl(url, bucketName);

    if (!relPath) {
      throw new ShelfError({
        cause: null,
        message: "Cannot extract the image path from the URL",
        additionalData: { url, bucketName },
        label,
      });
    }

    await deleteStoredFile(bucketName, relPath);
    return true;
  } catch (cause) {
    Logger.error(
      new ShelfError({
        cause,
        message: "Failed to delete the asset image",
        additionalData: { url, bucketName },
        label,
      })
    );
  }
}

/**
 * Returns the storage key path for a location or audit file upload.
 * Format: `{organizationId}/{type}/{typeId}/{randomId}`
 */
export function getFileUploadPath({
  organizationId,
  type,
  typeId,
}: {
  organizationId: string;
  type: "locations" | "audits";
  typeId: string;
}): string {
  return `${organizationId}/${type}/${typeId}/${id()}`;
}

/**
 * Removes a public file from the PUBLIC_BUCKET ("files").
 * Throws a ShelfError on failure (unlike deleteAssetImage which swallows errors).
 */
export async function removePublicFile({
  publicUrl,
}: {
  publicUrl: string;
}): Promise<void> {
  try {
    const relPath = extractPathFromUrl(publicUrl, PUBLIC_BUCKET);

    if (!relPath) {
      throw new ShelfError({
        cause: null,
        message: "Invalid file URL",
        additionalData: { publicUrl },
        label,
      });
    }

    await deleteStoredFile(PUBLIC_BUCKET, relPath);
  } catch (cause) {
    throw new ShelfError({
      cause,
      message: isLikeShelfError(cause)
        ? cause.message
        : "Failed to remove file. Please try again.",
      label,
    });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Deletes a file from the active storage driver. */
async function deleteStoredFile(
  bucketName: string,
  relPath: string
): Promise<void> {
  if (isLocal) {
    const filePath = localFilePath(bucketName, relPath);
    try {
      await fs.unlink(filePath);
    } catch (cause: any) {
      // Treat ENOENT as success — the file is gone either way
      if (cause?.code !== "ENOENT") throw cause;
    }
    return;
  }

  const { client, bucket } = getS3();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: `${bucketName}/${relPath}`,
    })
  );
}

/** Logs an upload error without rethrowing. */
function logUploadError(cause: unknown, additionalData: AdditionalData): void {
  Logger.error(
    new ShelfError({
      cause,
      message: "Failed to upload image",
      additionalData,
      label,
    })
  );
}

/**
 * Normalises the various shapes that parseFormData can hand us for file payloads
 * (Blob, File, Buffer, Node streams, async iterables) into an AsyncIterable
 * that Sharp can consume.
 */
async function normalizeToAsyncIterable(
  file:
    | AsyncIterable<Uint8Array>
    | Readable
    | Buffer
    | Blob
    | { stream?: () => any; arrayBuffer?: () => Promise<ArrayBuffer> }
    | null
    | undefined
): Promise<AsyncIterable<Uint8Array> | null> {
  if (!file) return null;

  if (typeof (file as any)[Symbol.asyncIterator] === "function") {
    return file as AsyncIterable<Uint8Array>;
  }

  if (file instanceof Readable) {
    return file as AsyncIterable<Uint8Array>;
  }

  if (Buffer.isBuffer(file)) {
    return (async function* bufferToIterable() {
      await Promise.resolve();
      yield file;
    })();
  }

  if (typeof (file as Blob).stream === "function") {
    const webStream = (file as Blob).stream();
    if (typeof Readable.fromWeb === "function") {
      return Readable.fromWeb(
        webStream as any
      ) as unknown as AsyncIterable<Uint8Array>;
    }
  }

  if (typeof (file as Blob).arrayBuffer === "function") {
    const buffer = Buffer.from(await (file as Blob).arrayBuffer());
    return (async function* bufferToIterable() {
      await Promise.resolve();
      yield buffer;
    })();
  }

  return null;
}

/**
 * Recursively walks the `.cause` chain to find a ShelfError.
 *
 * Libraries like @remix-run/form-data-parser wrap errors in their own
 * FormDataParseError, hiding the nested ShelfError. This helper recovers
 * the original message, title, and shouldBeCaptured flag.
 */
export function findShelfErrorInCause(error: unknown): ShelfError | null {
  if (isLikeShelfError(error)) return error;

  const cause = (error as { cause?: unknown })?.cause;
  if (!cause) return null;

  return findShelfErrorInCause(cause);
}

/**
 * Recursively walks the `.cause` chain to find a MaxFileSizeExceededError.
 */
function getMaxFileSizeExceededError(
  error: unknown
): MaxFileSizeExceededError | null {
  if (error instanceof MaxFileSizeExceededError) return error;

  const cause = (error as { cause?: unknown })?.cause;
  if (!cause) return null;

  return getMaxFileSizeExceededError(cause);
}

// ---------------------------------------------------------------------------
// Legacy Supabase error-shape helpers
// These are kept as exported stubs so that existing tests and any call sites
// that import them continue to compile. They always return false since the new
// storage drivers do not produce Supabase-shaped errors.
// ---------------------------------------------------------------------------

/** @deprecated No longer meaningful; kept for test compatibility only. */
export function isSupabaseRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const name =
    "name" in error && typeof error.name === "string" ? error.name : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const status =
    "status" in error && typeof error.status === "number" ? error.status : 0;
  const statusCode =
    "statusCode" in error && typeof error.statusCode === "string"
      ? error.statusCode
      : "";

  const isRateLimitStatus = status === 429 || statusCode === "429";
  const isRateLimitMessage = message.toLowerCase().includes("too many");
  const isStorageApiError = name === "StorageApiError";

  return isStorageApiError && (isRateLimitStatus || isRateLimitMessage);
}

/** @deprecated No longer meaningful; kept for test compatibility only. */
export function isSupabaseServerError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const name =
    "name" in error && typeof error.name === "string" ? error.name : "";
  const status =
    "status" in error && typeof error.status === "number" ? error.status : 0;
  const statusCode =
    "statusCode" in error && typeof error.statusCode === "string"
      ? error.statusCode
      : "";

  const isServerStatus =
    (status >= 500 && status <= 599) ||
    (statusCode !== "" &&
      Number(statusCode) >= 500 &&
      Number(statusCode) <= 599);
  const isStorageApiError = name === "StorageApiError";

  return isStorageApiError && isServerStatus;
}
