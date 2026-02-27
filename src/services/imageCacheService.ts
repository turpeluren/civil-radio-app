/**
 * Persistent on-disk image cache service.
 *
 * Stores cover art images in {Paths.document}/image-cache/ so they
 * survive app updates and are not purged by the OS.
 *
 * Each cover art ID gets its own subdirectory containing up to 4 size
 * variants (50, 150, 300, 600):
 *
 *   image-cache/{coverArtId}/50.jpg
 *   image-cache/{coverArtId}/150.jpg
 *   image-cache/{coverArtId}/300.jpg
 *   image-cache/{coverArtId}/600.jpg
 *
 * Only the 600px source is downloaded from the server. Smaller
 * variants (300, 150, 50) are generated locally using
 * expo-image-manipulator.
 *
 * Downloads are queued and processed with configurable concurrency,
 * mirroring the pattern used by musicCacheService. Incomplete (.tmp)
 * files are cleaned up on startup and resume from background, and
 * their items are re-queued.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { moveAsync, readDirectoryAsync } from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AppState, type AppStateStatus } from 'react-native';
import { fetch } from 'expo/fetch';

import { imageCacheStore } from '../store/imageCacheStore';
import { ensureCoverArtAuth, getCoverArtUrl } from './subsonicService';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** All image size tiers used across the app. */
export const IMAGE_SIZES = [50, 150, 300, 600] as const;

/** The single size downloaded from the server; smaller sizes are derived locally. */
const SOURCE_SIZE = 600;

/** Sizes generated locally from the SOURCE_SIZE image. */
const RESIZE_SIZES = [300, 150, 50] as const;

/** Supported extensions ordered by likelihood. */
const EXTENSIONS = ['.jpg', '.png', '.webp'] as const;

/** Map Content-Type to file extension. */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** JPEG quality for locally generated resize variants. */
const RESIZE_COMPRESS = 0.9;

/**
 * Navidrome coverArt IDs use the format `{type}-{entityId}_{hexTimestamp}`.
 * The hex suffix changes when art is re-indexed, but the prefix stays
 * stable for the same entity. Matches hex digits (0-9, a-f).
 */
const HEX_SUFFIX_RE = /^[0-9a-f]+$/i;

/* ------------------------------------------------------------------ */
/*  Module state                                                       */
/* ------------------------------------------------------------------ */

let cacheDir: Directory | null = null;
let isProcessing = false;
let appStateSubscription: { remove: () => void } | null = null;

/** CoverArtIds currently being downloaded/resized by a worker. */
const downloading = new Set<string>();

/** Ordered queue of coverArtIds waiting to be processed. */
const downloadQueue: string[] = [];

/**
 * Promise resolvers keyed by coverArtId. When a download finishes
 * (or is skipped), all registered resolvers for that ID are called
 * so callers of cacheAllSizes() are notified.
 */
const pendingResolvers = new Map<string, (() => void)[]>();

/**
 * In-memory URI cache: avoids repeated synchronous filesystem lookups
 * for the same coverArtId + size combination. Keyed by "coverArtId:size".
 */
const uriCache = new Map<string, string | null>();

function uriCacheKey(coverArtId: string, size: number): string {
  return `${coverArtId}:${size}`;
}

/* ------------------------------------------------------------------ */
/*  Initialisation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Create the image-cache directory under Paths.document and register
 * the AppState listener for resume-from-background cleanup.
 * Safe to call multiple times (no-ops if already initialised).
 */
export function initImageCache(): void {
  if (cacheDir) return;
  const dir = new Directory(Paths.document, 'image-cache');
  if (!dir.exists) {
    dir.create();
  }
  cacheDir = dir;

  recoverStalledImageDownloads();
  deduplicateCacheFolders();

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        recoverStalledImageDownloads();
      }
    });
  }
}

/** Return the initialised cache directory (auto-inits if needed). */
function ensureCacheDir(): Directory {
  if (!cacheDir) initImageCache();
  return cacheDir!;
}

/* ------------------------------------------------------------------ */
/*  Startup / resume recovery                                          */
/* ------------------------------------------------------------------ */

/**
 * Scan all subdirectories under image-cache/ for incomplete (.tmp)
 * files, delete them, and re-queue any coverArtId that is missing
 * size variants.
 *
 * Mirrors musicCacheService.recoverStalledDownloads().
 */
function recoverStalledImageDownloads(): void {
  const dir = ensureCacheDir();
  let subDirs: (File | Directory)[];
  try {
    subDirs = dir.list();
  } catch {
    return;
  }

  for (const subDir of subDirs) {
    if (!(subDir instanceof Directory)) continue;
    const coverArtId = subDir.uri.split('/').filter(Boolean).pop() ?? '';
    if (!coverArtId) continue;

    let hasTmp = false;
    let completeCount = 0;

    try {
      for (const entry of subDir.list()) {
        if (!(entry instanceof File)) continue;
        if (entry.uri.endsWith('.tmp')) {
          hasTmp = true;
          try { entry.delete(); } catch { /* best-effort */ }
        } else {
          completeCount++;
        }
      }
    } catch {
      continue;
    }

    if (hasTmp || completeCount < IMAGE_SIZES.length) {
      if (!downloading.has(coverArtId) && !downloadQueue.includes(coverArtId)) {
        // Evict stale URI cache entries so the queue processor re-checks disk.
        for (const s of IMAGE_SIZES) {
          uriCache.delete(uriCacheKey(coverArtId, s));
        }
        downloadQueue.push(coverArtId);
      }
    }
  }

  if (downloadQueue.length > 0) {
    processQueue();
  }
}

/* ------------------------------------------------------------------ */
/*  Cache lookup (synchronous)                                         */
/* ------------------------------------------------------------------ */

/**
 * Check if a cached image exists for the given coverArtId and size.
 * Returns the local `file://` URI or `null`.
 */
export function getCachedImageUri(
  coverArtId: string,
  size: number,
): string | null {
  if (!coverArtId) return null;

  const key = uriCacheKey(coverArtId, size);
  if (uriCache.has(key)) return uriCache.get(key)!;

  const subDir = new Directory(ensureCacheDir(), coverArtId);
  if (!subDir.exists) {
    uriCache.set(key, null);
    return null;
  }
  for (const ext of EXTENSIONS) {
    const file = new File(subDir, `${size}${ext}`);
    if (file.exists) {
      uriCache.set(key, file.uri);
      return file.uri;
    }
  }
  uriCache.set(key, null);
  return null;
}

/**
 * Evict a single in-memory cache entry so the next lookup hits the
 * filesystem. Used by CachedImage's onError recovery path.
 */
export function evictUriCacheEntry(coverArtId: string, size: number): void {
  uriCache.delete(uriCacheKey(coverArtId, size));
}

/* ------------------------------------------------------------------ */
/*  Queue management                                                   */
/* ------------------------------------------------------------------ */

/** Resolve and remove all pending promise callbacks for a coverArtId. */
function resolveWaiters(coverArtId: string): void {
  const resolvers = pendingResolvers.get(coverArtId);
  if (resolvers) {
    for (const resolve of resolvers) resolve();
    pendingResolvers.delete(coverArtId);
  }
}

/** Resolve all pending waiters (used when the cache is cleared). */
function resolveAllWaiters(): void {
  for (const [, resolvers] of pendingResolvers) {
    for (const resolve of resolvers) resolve();
  }
  pendingResolvers.clear();
}

/**
 * Enqueue a coverArtId for download + local resize. Returns a Promise
 * that resolves once the image has been fully cached (all 4 sizes) or
 * skipped. No-ops if all sizes are already on disk.
 */
export function cacheAllSizes(coverArtId: string): Promise<void> {
  if (!coverArtId) return Promise.resolve();

  const allCached = IMAGE_SIZES.every(
    (s) => getCachedImageUri(coverArtId, s) != null,
  );
  if (allCached) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const list = pendingResolvers.get(coverArtId) ?? [];
    list.push(resolve);
    pendingResolvers.set(coverArtId, list);

    if (downloading.has(coverArtId) || downloadQueue.includes(coverArtId)) {
      return;
    }

    downloadQueue.push(coverArtId);
    processQueue();
  });
}

/* ------------------------------------------------------------------ */
/*  Queue processing                                                   */
/* ------------------------------------------------------------------ */

/**
 * Process the download queue. Spawns up to maxConcurrentImageDownloads
 * workers using the same pool pattern as musicCacheService.
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  try {
    while (downloadQueue.length > 0) {
      const { maxConcurrentImageDownloads } = imageCacheStore.getState();
      const workerCount = Math.min(
        maxConcurrentImageDownloads,
        downloadQueue.length,
      );
      const workers = Array.from(
        { length: workerCount },
        () => processNext(),
      );
      await Promise.all(workers);
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Worker loop: dequeue one coverArtId at a time and download + resize.
 */
async function processNext(): Promise<void> {
  while (downloadQueue.length > 0) {
    const coverArtId = downloadQueue.shift()!;
    if (downloading.has(coverArtId)) {
      continue;
    }
    downloading.add(coverArtId);
    try {
      await downloadAndCacheImage(coverArtId);
    } catch {
      /* individual image failure -- continue with the rest */
    } finally {
      downloading.delete(coverArtId);
      for (const s of IMAGE_SIZES) {
        uriCache.delete(uriCacheKey(coverArtId, s));
        getCachedImageUri(coverArtId, s);
      }
      resolveWaiters(coverArtId);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Stale duplicate cleanup                                            */
/* ------------------------------------------------------------------ */

/**
 * Extract the stable entity key from a Navidrome-style coverArtId by
 * stripping the hex timestamp suffix. Returns `null` for IDs that
 * don't follow the `{prefix}_{hexDigits}` pattern (e.g. non-Navidrome
 * servers), so dedup is safely skipped for those.
 */
function entityPrefix(coverArtId: string): string | null {
  const i = coverArtId.lastIndexOf('_');
  if (i <= 0) return null;
  const suffix = coverArtId.slice(i + 1);
  if (!HEX_SUFFIX_RE.test(suffix)) return null;
  return coverArtId.slice(0, i);
}

/**
 * Remove cache folders that share the same entity prefix as
 * `coverArtId` but have a different (outdated) timestamp suffix.
 * Reuses {@link deleteCachedImage} for safe deletion with stat updates.
 */
function removeStaleFolders(coverArtId: string): void {
  const prefix = entityPrefix(coverArtId);
  if (!prefix) return;

  const dir = ensureCacheDir();
  let entries: (File | Directory)[];
  try {
    entries = dir.list();
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!(entry instanceof Directory)) continue;
    const name = entry.uri.split('/').filter(Boolean).pop() ?? '';
    if (name === coverArtId) continue;
    if (entityPrefix(name) === prefix) {
      deleteCachedImage(name);
    }
  }
}

/**
 * Batch-deduplicate all cache folders on startup. Groups directories
 * by entity prefix and, for each group with duplicates, keeps the one
 * with the highest hex suffix (newest timestamp) and deletes the rest.
 */
function deduplicateCacheFolders(): void {
  const dir = ensureCacheDir();
  let entries: (File | Directory)[];
  try {
    entries = dir.list();
  } catch {
    return;
  }

  const groups = new Map<string, string[]>();

  for (const entry of entries) {
    if (!(entry instanceof Directory)) continue;
    const name = entry.uri.split('/').filter(Boolean).pop() ?? '';
    const prefix = entityPrefix(name);
    if (!prefix) continue;
    const list = groups.get(prefix) ?? [];
    list.push(name);
    groups.set(prefix, list);
  }

  for (const [, ids] of groups) {
    if (ids.length <= 1) continue;

    ids.sort((a, b) => {
      const aHex = a.slice(a.lastIndexOf('_') + 1);
      const bHex = b.slice(b.lastIndexOf('_') + 1);
      const aVal = parseInt(aHex, 16);
      const bVal = parseInt(bHex, 16);
      return bVal - aVal;
    });

    for (let i = 1; i < ids.length; i++) {
      deleteCachedImage(ids[i]);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Download + resize pipeline                                         */
/* ------------------------------------------------------------------ */

/**
 * Download the 600px source from the server (if not already cached)
 * and generate the 300, 150, and 50px variants locally.
 */
async function downloadAndCacheImage(coverArtId: string): Promise<void> {
  const subDir = new Directory(ensureCacheDir(), coverArtId);
  if (!subDir.exists) subDir.create();

  let source600Uri = getCachedImageUri(coverArtId, SOURCE_SIZE);
  if (!source600Uri) {
    source600Uri = await downloadSourceImage(coverArtId, subDir);
    if (!source600Uri) return;
  }

  for (const size of RESIZE_SIZES) {
    if (getCachedImageUri(coverArtId, size)) continue;
    await generateResizedVariant(source600Uri, coverArtId, size, subDir);
  }

  removeStaleFolders(coverArtId);
}

/**
 * Download the source (600px) image from the Subsonic server.
 * Writes to a .tmp file first, then renames on success.
 * Returns the local file:// URI on success, or null on failure.
 */
async function downloadSourceImage(
  coverArtId: string,
  subDir: Directory,
): Promise<string | null> {
  await ensureCoverArtAuth();
  const url = getCoverArtUrl(coverArtId, SOURCE_SIZE);
  if (!url) return null;

  let tmpName: string | null = null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') ?? '';
    const ext = MIME_TO_EXT[contentType.split(';')[0].trim()] ?? '.jpg';
    const fileName = `${SOURCE_SIZE}${ext}`;
    tmpName = `${fileName}.tmp`;

    const tmpFile = new File(subDir, tmpName);
    const bytes = new Uint8Array(await response.arrayBuffer());
    tmpFile.write(bytes);

    const dest = new File(subDir, fileName);
    if (dest.exists) {
      try { dest.delete(); } catch { /* best-effort */ }
    }
    tmpFile.move(dest);

    imageCacheStore.getState().addFile(bytes.length);
    uriCache.set(uriCacheKey(coverArtId, SOURCE_SIZE), dest.uri);

    return dest.uri;
  } catch {
    if (tmpName) {
      const tmp = new File(subDir, tmpName);
      if (tmp.exists) {
        try { tmp.delete(); } catch { /* best-effort */ }
      }
    }
    return null;
  }
}

/**
 * Generate a single resized variant from the 600px source using
 * expo-image-manipulator. Writes to a .tmp file first, then renames.
 */
async function generateResizedVariant(
  sourceUri: string,
  coverArtId: string,
  size: number,
  subDir: Directory,
): Promise<void> {
  const fileName = `${size}.jpg`;
  const tmpName = `${fileName}.tmp`;
  try {
    const context = ImageManipulator.manipulate(sourceUri);
    context.resize({ width: size });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: RESIZE_COMPRESS,
    });

    const tmpFile = new File(subDir, tmpName);
    await moveAsync({ from: saved.uri, to: tmpFile.uri });

    const dest = new File(subDir, fileName);
    if (dest.exists) {
      try { dest.delete(); } catch { /* best-effort */ }
    }
    tmpFile.move(dest);

    imageCacheStore.getState().addFile(dest.size ?? 0);
    uriCache.set(uriCacheKey(coverArtId, size), dest.uri);
  } catch {
    const tmp = new File(subDir, tmpName);
    if (tmp.exists) {
      try { tmp.delete(); } catch { /* best-effort */ }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Cache stats                                                        */
/* ------------------------------------------------------------------ */

export interface ImageCacheStats {
  /** Total bytes used by the image cache. */
  totalBytes: number;
  /** Number of unique cover art images cached (each has 4 size variants). */
  imageCount: number;
}

/**
 * Calculate cache statistics.
 */
export function getImageCacheStats(): ImageCacheStats {
  const dir = ensureCacheDir();
  const totalBytes = dir.size ?? 0;

  let imageCount = 0;
  try {
    const contents = dir.list();
    imageCount = contents.filter((item) => item instanceof Directory).length;
  } catch {
    imageCount = 0;
  }

  return { totalBytes, imageCount };
}

/* ------------------------------------------------------------------ */
/*  Cache browsing                                                     */
/* ------------------------------------------------------------------ */

/** A single cached file variant. */
interface CachedFileEntry {
  size: number;
  fileName: string;
  uri: string;
}

/** A cached image with all its size variants. */
export interface CachedImageEntry {
  coverArtId: string;
  files: CachedFileEntry[];
}

/** Regex to parse size-variant filenames: {size}.{ext} */
const SIZE_FILE_RE = /^(50|150|300|600)\.(jpg|png|webp)$/;

/**
 * List all cached images grouped by coverArtId.
 * Each entry includes the individual file variants found on disk.
 */
function listCachedImages(): CachedImageEntry[] {
  const dir = ensureCacheDir();
  let subDirs: (File | Directory)[];
  try {
    subDirs = dir.list();
  } catch {
    return [];
  }

  const entries: CachedImageEntry[] = [];

  for (const subDir of subDirs) {
    if (!(subDir instanceof Directory)) continue;
    const coverArtId = subDir.uri.split('/').filter(Boolean).pop() ?? '';
    if (!coverArtId) continue;

    const files: CachedFileEntry[] = [];
    try {
      for (const item of subDir.list()) {
        if (!(item instanceof File)) continue;
        const name = item.uri.split('/').pop() ?? '';
        const match = SIZE_FILE_RE.exec(name);
        if (!match) continue;
        files.push({ size: Number(match[1]), fileName: name, uri: item.uri });
      }
    } catch {
      continue;
    }

    if (files.length > 0) {
      files.sort((a, b) => a.size - b.size);
      entries.push({ coverArtId, files });
    }
  }

  entries.sort((a, b) => a.coverArtId.localeCompare(b.coverArtId));
  return entries;
}

/**
 * Async version of {@link listCachedImages} that uses the legacy
 * `readDirectoryAsync` API so the directory listing runs on a native
 * background thread instead of blocking the JS thread.
 */
export async function listCachedImagesAsync(): Promise<CachedImageEntry[]> {
  const dir = ensureCacheDir();
  const dirUri = dir.uri.endsWith('/') ? dir.uri : `${dir.uri}/`;

  let subDirNames: string[];
  try {
    subDirNames = await readDirectoryAsync(dir.uri);
  } catch {
    return [];
  }

  const entries: CachedImageEntry[] = [];

  for (const coverArtId of subDirNames) {
    const subDirUri = `${dirUri}${coverArtId}`;
    let fileNames: string[];
    try {
      fileNames = await readDirectoryAsync(subDirUri);
    } catch {
      continue;
    }

    const subUri = subDirUri.endsWith('/') ? subDirUri : `${subDirUri}/`;
    const files: CachedFileEntry[] = [];

    for (const name of fileNames) {
      const match = SIZE_FILE_RE.exec(name);
      if (!match) continue;
      files.push({ size: Number(match[1]), fileName: name, uri: `${subUri}${name}` });
    }

    if (files.length > 0) {
      files.sort((a, b) => a.size - b.size);
      entries.push({ coverArtId, files });
    }
  }

  entries.sort((a, b) => a.coverArtId.localeCompare(b.coverArtId));
  return entries;
}

/**
 * Delete all cached variants for a single coverArtId.
 * Updates the imageCacheStore stats accordingly.
 */
export function deleteCachedImage(coverArtId: string): void {
  if (!coverArtId) return;

  for (const s of IMAGE_SIZES) {
    uriCache.delete(uriCacheKey(coverArtId, s));
  }

  const subDir = new Directory(ensureCacheDir(), coverArtId);
  if (!subDir.exists) return;

  let deletedCount = 0;
  let deletedBytes = 0;
  try {
    for (const item of subDir.list()) {
      if (item instanceof File) {
        deletedBytes += item.size ?? 0;
        deletedCount++;
      }
    }
  } catch {
    /* best-effort -- proceed with deletion regardless */
  }

  try {
    subDir.delete();
  } catch {
    /* may fail if already removed */
  }

  if (deletedCount > 0) {
    imageCacheStore.getState().removeFiles(deletedCount, deletedBytes);
  }
}

/**
 * Re-download all size variants for a single coverArtId.
 * Deletes existing files first, then re-enqueues for a fresh download.
 */
export function refreshCachedImage(coverArtId: string): Promise<void> {
  deleteCachedImage(coverArtId);
  downloading.delete(coverArtId);
  const idx = downloadQueue.indexOf(coverArtId);
  if (idx !== -1) downloadQueue.splice(idx, 1);
  return cacheAllSizes(coverArtId);
}

/* ------------------------------------------------------------------ */
/*  Cache clearing                                                     */
/* ------------------------------------------------------------------ */

/**
 * Delete all cached images and recreate the cache directory.
 * Returns the number of bytes freed.
 */
export function clearImageCache(): number {
  const dir = ensureCacheDir();
  const freedBytes = dir.size ?? 0;
  try {
    dir.delete();
  } catch {
    /* may fail if already empty */
  }
  cacheDir = null;
  uriCache.clear();
  downloadQueue.length = 0;
  downloading.clear();
  resolveAllWaiters();
  initImageCache();
  imageCacheStore.getState().reset();
  return freedBytes;
}
