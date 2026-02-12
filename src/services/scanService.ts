import { scanStatusStore } from '../store/scanStatusStore';
import {
  getScanStatus as apiGetScanStatus,
  startScan as apiStartScan,
} from './subsonicService';

const POLL_INTERVAL_MS = 2000;

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling the server for scan status updates.
 * No-ops if already polling.
 */
export function startPolling(): void {
  if (pollTimer != null) return;
  pollTimer = setInterval(async () => {
    const result = await apiGetScanStatus();
    if (result) {
      scanStatusStore.getState().setScanStatus(result);
      if (!result.scanning) {
        stopPolling();
      }
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the polling interval.
 */
export function stopPolling(): void {
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Fetch the current scan status from the server and update the store.
 * Automatically starts polling if a scan is in progress.
 */
export async function fetchScanStatus(): Promise<void> {
  const store = scanStatusStore.getState();
  store.setLoading(true);
  const result = await apiGetScanStatus();
  if (result) {
    store.setScanStatus(result);
    if (result.scanning) {
      startPolling();
    } else {
      stopPolling();
    }
  } else {
    store.setError('Failed to fetch scan status');
  }
  store.setLoading(false);
}

/**
 * Start a library scan on the server and begin polling for progress.
 * @param fullScan Only supported by Navidrome – performs a full scan instead of incremental.
 */
export async function startScan(fullScan?: boolean): Promise<void> {
  const store = scanStatusStore.getState();
  store.setLoading(true);
  const result = await apiStartScan(fullScan);
  if (result) {
    store.setScanStatus(result);
    if (result.scanning) {
      startPolling();
    }
  } else {
    store.setError('Failed to start scan');
  }
  store.setLoading(false);
}
