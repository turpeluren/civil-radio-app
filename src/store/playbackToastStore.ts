import { create } from 'zustand';

export type PlaybackToastStatus = 'idle' | 'loading' | 'success' | 'error';

const MIN_LOADING_MS = 1200;

export interface PlaybackToastState {
  status: PlaybackToastStatus;
  errorMessage: string | null;
  /**
   * Optional label override for the success state. When set, `PlaybackToast`
   * renders this instead of the default `t('nowPlaying')` — lets the same
   * pill surface non-playback confirmations (e.g. "Added to download queue")
   * without duplicating the component.
   */
  successLabel: string | null;
  /** Timestamp when `show()` was called — used to enforce minimum loading duration. */
  _showedAt: number;

  show: () => void;
  succeed: () => void;
  /**
   * Skip the loading phase and flash a one-shot success pill with a custom
   * label. Used by features where the action completes synchronously and the
   * user just needs a quick confirmation (download enqueued, etc.).
   */
  flashSuccess: (label: string) => void;
  fail: (message: string) => void;
  hide: () => void;
}

export const playbackToastStore = create<PlaybackToastState>()((set, get) => ({
  status: 'idle',
  errorMessage: null,
  successLabel: null,
  _showedAt: 0,

  show: () => set({ status: 'loading', errorMessage: null, successLabel: null, _showedAt: Date.now() }),

  succeed: () => {
    const elapsed = Date.now() - get()._showedAt;
    const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
    setTimeout(() => set({ status: 'success', errorMessage: null }), remaining);
  },

  flashSuccess: (label) => set({
    status: 'success',
    errorMessage: null,
    successLabel: label,
    _showedAt: Date.now(),
  }),

  fail: (message) => {
    const elapsed = Date.now() - get()._showedAt;
    const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
    setTimeout(() => set({ status: 'error', errorMessage: message }), remaining);
  },

  hide: () => set({ status: 'idle', errorMessage: null, successLabel: null }),
}));
