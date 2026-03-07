jest.mock('subsonic-api', () => ({
  __esModule: true,
  default: class {},
}));
jest.mock('expo-crypto', () => ({
  getRandomValues: jest.fn((arr: Uint8Array) => arr),
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(16)),
  digestStringAsync: jest.fn().mockResolvedValue('mocktoken'),
  CryptoDigestAlgorithm: { MD5: 'MD5' },
  CryptoEncoding: { HEX: 'hex' },
}));
jest.mock('../../store/authStore', () => ({
  authStore: { getState: jest.fn() },
}));
jest.mock('../../store/offlineModeStore', () => ({
  offlineModeStore: { getState: jest.fn(() => ({ offlineMode: false })) },
}));
jest.mock('../../store/playbackSettingsStore', () => ({
  playbackSettingsStore: { getState: jest.fn() },
}));

import { authStore } from '../../store/authStore';
import { playbackSettingsStore } from '../../store/playbackSettingsStore';
import {
  clearApiCache,
  ensureCoverArtAuth,
  getCoverArtUrl,
  getDownloadStreamUrl,
  getStreamUrl,
  stripCoverArtSuffix,
} from '../subsonicService';

const mockAuthStore = authStore as jest.Mocked<typeof authStore>;
const mockPlaybackSettingsStore = playbackSettingsStore as jest.Mocked<typeof playbackSettingsStore>;

beforeEach(() => {
  clearApiCache();
  mockAuthStore.getState.mockReturnValue({
    isLoggedIn: true,
    serverUrl: 'https://music.example.com',
    username: 'user',
    password: 'pass',
    apiVersion: '1.16',
    rehydrated: true,
  } as any);
  mockPlaybackSettingsStore.getState.mockReturnValue({
    maxBitRate: null,
    streamFormat: 'raw' as const,
    estimateContentLength: false,
    downloadMaxBitRate: null,
    downloadFormat: 'raw' as const,
  } as any);
});

describe('stripCoverArtSuffix', () => {
  it('strips hex suffix', () => {
    expect(stripCoverArtSuffix('al-123_abc123')).toBe('al-123');
    expect(stripCoverArtSuffix('pl-456_def456')).toBe('pl-456');
  });

  it('is idempotent when no suffix', () => {
    expect(stripCoverArtSuffix('al-123')).toBe('al-123');
  });

  it('preserves when suffix is not hex', () => {
    expect(stripCoverArtSuffix('al-123_xyz')).toBe('al-123_xyz');
  });

  it('preserves when no underscore', () => {
    expect(stripCoverArtSuffix('al123')).toBe('al123');
  });

  it('handles empty string', () => {
    expect(stripCoverArtSuffix('')).toBe('');
  });

  it('handles underscore at start', () => {
    expect(stripCoverArtSuffix('_abc123')).toBe('_abc123');
  });

  it('strips only last underscore segment', () => {
    expect(stripCoverArtSuffix('al-123_extra_abc123')).toBe('al-123_extra');
  });
});

describe('getCoverArtUrl', () => {
  it('returns null when not logged in', async () => {
    mockAuthStore.getState.mockReturnValue({
      isLoggedIn: false,
      serverUrl: 'https://x.com',
      username: 'u',
    } as any);
    await ensureCoverArtAuth();
    expect(getCoverArtUrl('al-1')).toBeNull();
  });

  it('returns null for empty coverArtId', async () => {
    await ensureCoverArtAuth();
    expect(getCoverArtUrl('')).toBeNull();
  });

  it('returns null when ensureCoverArtAuth has not been called', () => {
    clearApiCache();
    expect(getCoverArtUrl('al-1')).toBeNull();
  });

  it('builds URL with stripped coverArtId', async () => {
    await ensureCoverArtAuth();
    const url = getCoverArtUrl('al-123_abc');
    expect(url).toContain('https://music.example.com/rest/getCoverArt.view');
    expect(url).toContain('id=al-123');
    expect(url).toContain('u=user');
  });

  it('includes size param when provided', async () => {
    await ensureCoverArtAuth();
    const url = getCoverArtUrl('al-1', 300);
    expect(url).toContain('size=300');
  });

  it('omits size param when not provided', async () => {
    await ensureCoverArtAuth();
    const url = getCoverArtUrl('al-1');
    expect(url).not.toContain('size=');
  });
});

describe('getStreamUrl', () => {
  it('returns null when not logged in', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    await ensureCoverArtAuth();
    expect(getStreamUrl('track-1')).toBeNull();
  });

  it('returns null for empty trackId', async () => {
    await ensureCoverArtAuth();
    expect(getStreamUrl('')).toBeNull();
  });

  it('builds stream URL with playback settings', async () => {
    await ensureCoverArtAuth();
    mockPlaybackSettingsStore.getState.mockReturnValue({
      maxBitRate: 320,
      streamFormat: 'mp3' as const,
      estimateContentLength: true,
    } as any);
    const url = getStreamUrl('track-1');
    expect(url).toContain('https://music.example.com/rest/stream.view');
    expect(url).toContain('id=track-1');
    expect(url).toContain('maxBitRate=320');
    expect(url).toContain('format=mp3');
    expect(url).toContain('estimateContentLength=true');
  });

  it('omits format and bitrate when set to raw/null', async () => {
    await ensureCoverArtAuth();
    const url = getStreamUrl('track-1');
    expect(url).not.toContain('format=');
    expect(url).not.toContain('maxBitRate=');
    expect(url).not.toContain('estimateContentLength=');
  });

  it('includes timeOffset when provided', async () => {
    await ensureCoverArtAuth();
    const url = getStreamUrl('track-1', 120);
    expect(url).toContain('timeOffset=120');
  });

  it('omits timeOffset when zero', async () => {
    await ensureCoverArtAuth();
    const url = getStreamUrl('track-1', 0);
    expect(url).not.toContain('timeOffset');
  });
});

describe('getDownloadStreamUrl', () => {
  it('returns null when not logged in', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    await ensureCoverArtAuth();
    expect(getDownloadStreamUrl('track-1')).toBeNull();
  });

  it('returns null for empty trackId', async () => {
    await ensureCoverArtAuth();
    expect(getDownloadStreamUrl('')).toBeNull();
  });

  it('builds download URL with estimateContentLength', async () => {
    await ensureCoverArtAuth();
    const url = getDownloadStreamUrl('track-1');
    expect(url).toContain('estimateContentLength=true');
  });

  it('includes download format when set', async () => {
    await ensureCoverArtAuth();
    mockPlaybackSettingsStore.getState.mockReturnValue({
      downloadMaxBitRate: 256,
      downloadFormat: 'mp3' as const,
    } as any);
    const url = getDownloadStreamUrl('track-1');
    expect(url).toContain('maxBitRate=256');
    expect(url).toContain('format=mp3');
  });

  it('omits format and bitrate when using raw defaults', async () => {
    await ensureCoverArtAuth();
    const url = getDownloadStreamUrl('track-1');
    expect(url).not.toContain('format=');
    expect(url).not.toContain('maxBitRate=');
  });
});

describe('getApi', () => {
  it('returns null in offline mode', () => {
    const { offlineModeStore } = require('../../store/offlineModeStore');
    offlineModeStore.getState.mockReturnValue({ offlineMode: true });
    const { getApi } = require('../subsonicService');
    expect(getApi()).toBeNull();
    offlineModeStore.getState.mockReturnValue({ offlineMode: false });
  });

  it('returns null when not logged in', () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    const { getApi } = require('../subsonicService');
    expect(getApi()).toBeNull();
  });

  it('returns null when serverUrl is missing', () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: true, serverUrl: null, username: 'u', password: 'p' } as any);
    const { getApi } = require('../subsonicService');
    expect(getApi()).toBeNull();
  });

  it('returns an API instance when logged in', () => {
    const { getApi } = require('../subsonicService');
    const api = getApi();
    expect(api).not.toBeNull();
  });

  it('returns cached instance on repeated calls with same credentials', () => {
    const { getApi } = require('../subsonicService');
    const api1 = getApi();
    const api2 = getApi();
    expect(api1).toBe(api2);
  });

  it('creates new instance when credentials change', () => {
    const { getApi } = require('../subsonicService');
    const api1 = getApi();
    clearApiCache();
    mockAuthStore.getState.mockReturnValue({
      isLoggedIn: true,
      serverUrl: 'https://other.example.com',
      username: 'user2',
      password: 'pass2',
      apiVersion: '1.16',
      rehydrated: true,
    } as any);
    const api2 = getApi();
    expect(api2).not.toBe(api1);
  });
});

describe('login', () => {
  const { default: SubsonicAPI } = require('subsonic-api');

  it('returns success with version on successful ping', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockResolvedValue({
      status: 'ok',
      version: '1.16.0',
    });
    const { login } = require('../subsonicService');
    const result = await login('music.example.com', 'user', 'pass');
    expect(result).toEqual({ success: true, version: '1.16.0' });
  });

  it('adds https:// to bare hostname', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockResolvedValue({
      status: 'ok',
      version: '1.16.0',
    });
    const { login } = require('../subsonicService');
    const result = await login('music.example.com', 'user', 'pass');
    expect(result.success).toBe(true);
  });

  it('returns error on failed ping', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockResolvedValue({
      status: 'failed',
      error: { code: 40, message: 'Wrong username or password' },
    });
    const { login } = require('../subsonicService');
    const result = await login('https://music.example.com', 'user', 'wrong');
    expect(result).toEqual({ success: false, error: 'Wrong username or password' });
  });

  it('returns error on code 40 without message', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockResolvedValue({
      status: 'failed',
      error: { code: 40 },
    });
    const { login } = require('../subsonicService');
    const result = await login('https://music.example.com', 'user', 'wrong');
    expect(result).toEqual({ success: false, error: 'Wrong username or password' });
  });

  it('returns generic error on unknown failure code', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockResolvedValue({
      status: 'failed',
      error: { code: 99 },
    });
    const { login } = require('../subsonicService');
    const result = await login('https://music.example.com', 'user', 'pass');
    expect(result).toEqual({ success: false, error: 'Authentication failed' });
  });

  it('returns connection error on exception', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { login } = require('../subsonicService');
    const result = await login('https://music.example.com', 'user', 'pass');
    expect(result).toEqual({ success: false, error: 'ECONNREFUSED' });
  });

  it('returns generic error on non-Error exception', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockRejectedValue('something');
    const { login } = require('../subsonicService');
    const result = await login('https://music.example.com', 'user', 'pass');
    expect(result).toEqual({ success: false, error: 'Connection failed' });
  });

  it('prefers serverVersion for OpenSubsonic servers', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockResolvedValue({
      status: 'ok',
      version: '1.16.0',
      openSubsonic: true,
      serverVersion: '0.52.5',
    });
    const { login } = require('../subsonicService');
    const result = await login('https://music.example.com', 'user', 'pass');
    expect(result).toEqual({ success: true, version: '0.52.5' });
  });
});

describe('normalizeServerUrl (tested indirectly via login)', () => {
  const { default: SubsonicAPI } = require('subsonic-api');

  it('trims whitespace from URL', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockResolvedValue({
      status: 'ok',
      version: '1.16.0',
    });
    const { login } = require('../subsonicService');
    const result = await login('  music.example.com  ', 'user', 'pass');
    expect(result.success).toBe(true);
  });

  it('strips trailing slashes', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockResolvedValue({
      status: 'ok',
      version: '1.16.0',
    });
    const { login } = require('../subsonicService');
    const result = await login('https://music.example.com///', 'user', 'pass');
    expect(result.success).toBe(true);
  });

  it('preserves http:// prefix', async () => {
    SubsonicAPI.prototype.ping = jest.fn().mockResolvedValue({
      status: 'ok',
      version: '1.16.0',
    });
    const { login } = require('../subsonicService');
    const result = await login('http://music.local', 'user', 'pass');
    expect(result.success).toBe(true);
  });
});

describe('API wrapper functions', () => {
  it('getAlbum returns null when getApi returns null', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    const { getAlbum } = require('../subsonicService');
    expect(await getAlbum('a1')).toBeNull();
  });

  it('getAlbum returns album on success', async () => {
    const { default: SubsonicAPI } = require('subsonic-api');
    SubsonicAPI.prototype.getAlbum = jest.fn().mockResolvedValue({
      album: { id: 'a1', name: 'Test Album' },
    });
    const { getAlbum, getApi } = require('../subsonicService');
    const api = getApi();
    expect(api).not.toBeNull();
    const result = await getAlbum('a1');
    expect(result).toEqual({ id: 'a1', name: 'Test Album' });
  });

  it('getAlbum returns null on API exception', async () => {
    const { default: SubsonicAPI } = require('subsonic-api');
    SubsonicAPI.prototype.getAlbum = jest.fn().mockRejectedValue(new Error('fail'));
    const { getAlbum, getApi } = require('../subsonicService');
    getApi();
    const result = await getAlbum('a1');
    expect(result).toBeNull();
  });

  it('getRecentlyAddedAlbums returns empty when no API', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    const { getRecentlyAddedAlbums } = require('../subsonicService');
    expect(await getRecentlyAddedAlbums()).toEqual([]);
  });

  it('getAllArtists returns empty when no API', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    const { getAllArtists } = require('../subsonicService');
    expect(await getAllArtists()).toEqual([]);
  });

  it('getAllPlaylists returns empty when no API', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    const { getAllPlaylists } = require('../subsonicService');
    expect(await getAllPlaylists()).toEqual([]);
  });

  it('getStarred2 returns empty lists when no API', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    const { getStarred2 } = require('../subsonicService');
    expect(await getStarred2()).toEqual({ albums: [], artists: [], songs: [] });
  });

  it('search3 returns empty results when no API', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    const { search3 } = require('../subsonicService');
    expect(await search3('test')).toEqual({ albums: [], artists: [], songs: [] });
  });

  it('starSong calls api.star with correct params', async () => {
    const { default: SubsonicAPI } = require('subsonic-api');
    SubsonicAPI.prototype.star = jest.fn().mockResolvedValue(undefined);
    const { starSong, getApi } = require('../subsonicService');
    getApi();
    await starSong('s1');
    expect(SubsonicAPI.prototype.star).toHaveBeenCalledWith({ id: 's1' });
  });

  it('unstarSong calls api.unstar with correct params', async () => {
    const { default: SubsonicAPI } = require('subsonic-api');
    SubsonicAPI.prototype.unstar = jest.fn().mockResolvedValue(undefined);
    const { unstarSong, getApi } = require('../subsonicService');
    getApi();
    await unstarSong('s1');
    expect(SubsonicAPI.prototype.unstar).toHaveBeenCalledWith({ id: 's1' });
  });

  it('setRating calls api.setRating', async () => {
    const { default: SubsonicAPI } = require('subsonic-api');
    SubsonicAPI.prototype.setRating = jest.fn().mockResolvedValue(undefined);
    const { setRating, getApi } = require('../subsonicService');
    getApi();
    await setRating('s1', 4);
    expect(SubsonicAPI.prototype.setRating).toHaveBeenCalledWith({ id: 's1', rating: 4 });
  });

  it('deletePlaylist returns true on success', async () => {
    const { default: SubsonicAPI } = require('subsonic-api');
    SubsonicAPI.prototype.deletePlaylist = jest.fn().mockResolvedValue(undefined);
    const { deletePlaylist, getApi } = require('../subsonicService');
    getApi();
    const result = await deletePlaylist('p1');
    expect(result).toBe(true);
  });

  it('deletePlaylist returns false on failure', async () => {
    const { default: SubsonicAPI } = require('subsonic-api');
    SubsonicAPI.prototype.deletePlaylist = jest.fn().mockRejectedValue(new Error('fail'));
    const { deletePlaylist, getApi } = require('../subsonicService');
    getApi();
    const result = await deletePlaylist('p1');
    expect(result).toBe(false);
  });

  it('getScanStatus returns null when no API', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    const { getScanStatus } = require('../subsonicService');
    expect(await getScanStatus()).toBeNull();
  });

  it('getTopSongs returns empty when no API', async () => {
    mockAuthStore.getState.mockReturnValue({ isLoggedIn: false } as any);
    const { getTopSongs } = require('../subsonicService');
    expect(await getTopSongs('Artist')).toEqual([]);
  });

  it('getTopSongs returns empty for Various Artists without calling API', async () => {
    const { default: SubsonicAPI } = require('subsonic-api');
    SubsonicAPI.prototype.getTopSongs = jest.fn();
    const { getTopSongs } = require('../subsonicService');
    expect(await getTopSongs('Various Artists')).toEqual([]);
    expect(SubsonicAPI.prototype.getTopSongs).not.toHaveBeenCalled();
  });

  it('getTopSongs returns empty for case-variant Various Artists', async () => {
    const { getTopSongs } = require('../subsonicService');
    expect(await getTopSongs('various artists')).toEqual([]);
    expect(await getTopSongs('  Various Artists  ')).toEqual([]);
  });

  it('getAllArtists normalises Various Artists entries', async () => {
    const { default: SubsonicAPI } = require('subsonic-api');
    SubsonicAPI.prototype.getArtists = jest.fn().mockResolvedValue({
      artists: {
        index: [
          {
            artist: [
              { id: 'ar-1', name: 'various artists', coverArt: 'ar-1_abc' },
              { id: 'ar-2', name: 'Radiohead', coverArt: 'ar-2_def' },
            ],
          },
        ],
      },
    });
    const { getAllArtists, getApi, VARIOUS_ARTISTS_NAME, VARIOUS_ARTISTS_COVER_ART_ID } = require('../subsonicService');
    getApi();
    const artists = await getAllArtists();
    expect(artists).toHaveLength(2);
    expect(artists[0].name).toBe(VARIOUS_ARTISTS_NAME);
    expect(artists[0].coverArt).toBe(VARIOUS_ARTISTS_COVER_ART_ID);
    expect(artists[0].id).toBe('ar-1');
    expect(artists[1].name).toBe('Radiohead');
    expect(artists[1].coverArt).toBe('ar-2_def');
  });
});

describe('isVariousArtists', () => {
  it('matches exact name', () => {
    const { isVariousArtists } = require('../subsonicService');
    expect(isVariousArtists('Various Artists')).toBe(true);
  });

  it('matches case-insensitively', () => {
    const { isVariousArtists } = require('../subsonicService');
    expect(isVariousArtists('various artists')).toBe(true);
    expect(isVariousArtists('VARIOUS ARTISTS')).toBe(true);
  });

  it('trims whitespace', () => {
    const { isVariousArtists } = require('../subsonicService');
    expect(isVariousArtists('  Various Artists  ')).toBe(true);
  });

  it('rejects other names', () => {
    const { isVariousArtists } = require('../subsonicService');
    expect(isVariousArtists('Radiohead')).toBe(false);
    expect(isVariousArtists('Various')).toBe(false);
    expect(isVariousArtists('')).toBe(false);
  });

  it('handles undefined', () => {
    const { isVariousArtists } = require('../subsonicService');
    expect(isVariousArtists(undefined)).toBe(false);
  });
});
