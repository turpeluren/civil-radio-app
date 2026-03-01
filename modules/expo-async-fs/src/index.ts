import ExpoAsyncFsModule from './ExpoAsyncFsModule';

import { type EventSubscription } from 'expo-modules-core';

export { type DownloadProgressEvent } from './ExpoAsyncFsModule';

/**
 * List directory contents asynchronously on a native background thread.
 * Returns an array of entry names (not full paths).
 */
export function listDirectoryAsync(uri: string): Promise<string[]> {
  return ExpoAsyncFsModule.listDirectoryAsync(uri);
}

/**
 * Calculate total size (in bytes) of a directory recursively
 * on a native background thread.
 */
export function getDirectorySizeAsync(uri: string): Promise<number> {
  return ExpoAsyncFsModule.getDirectorySizeAsync(uri);
}

/**
 * Download a file on the native layer with progress events.
 * Returns the destination URI and total bytes written.
 */
export function downloadFileAsyncWithProgress(
  url: string,
  destinationUri: string,
  downloadId: string,
): Promise<{ uri: string; bytes: number }> {
  return ExpoAsyncFsModule.downloadFileAsyncWithProgress(url, destinationUri, downloadId);
}

/**
 * Subscribe to download progress events. Each event contains
 * downloadId, bytesWritten, and totalBytes (-1 if unknown).
 */
export function addDownloadProgressListener(
  listener: (event: { downloadId: string; bytesWritten: number; totalBytes: number }) => void,
): EventSubscription {
  return ExpoAsyncFsModule.addListener('onDownloadProgress', listener);
}
