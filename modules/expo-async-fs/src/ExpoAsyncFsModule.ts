import { type EventSubscription, requireNativeModule } from 'expo-modules-core';

export interface DownloadProgressEvent {
  downloadId: string;
  bytesWritten: number;
  totalBytes: number;
}

interface DownloadResult {
  uri: string;
  bytes: number;
}

interface ExpoAsyncFsNativeModule {
  listDirectoryAsync(uri: string): Promise<string[]>;
  getDirectorySizeAsync(uri: string): Promise<number>;
  downloadFileAsyncWithProgress(
    url: string,
    destinationUri: string,
    downloadId: string,
  ): Promise<DownloadResult>;
  addListener(eventName: string, listener: (event: DownloadProgressEvent) => void): EventSubscription;
}

let module: ExpoAsyncFsNativeModule;

try {
  module = requireNativeModule('ExpoAsyncFs');
} catch {
  console.warn(
    '[expo-async-fs] Native module not found. ' +
      'Run `npx expo run:ios` or `npx expo run:android` to rebuild with the native module.'
  );

  module = {
    listDirectoryAsync: () => Promise.resolve([]),
    getDirectorySizeAsync: () => Promise.resolve(0),
    downloadFileAsyncWithProgress: () => Promise.resolve({ uri: '', bytes: 0 }),
    addListener: () => ({ remove: () => {} }),
  } as unknown as ExpoAsyncFsNativeModule;
}

export default module;
