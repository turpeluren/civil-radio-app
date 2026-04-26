jest.mock('../persistence/kvStorage', () => require('../persistence/__mocks__/kvStorage'));
jest.mock('../../services/subsonicService');
jest.mock('../../services/imageCacheService', () => ({
  cacheAllSizes: jest.fn().mockResolvedValue(undefined),
  cacheEntityCoverArt: jest.fn(),
}));

import { getStarred2 } from '../../services/subsonicService';
import { favoritesStore } from '../favoritesStore';

const mockGetStarred2 = getStarred2 as jest.MockedFunction<typeof getStarred2>;

beforeEach(() => {
  jest.clearAllMocks();
  favoritesStore.getState().clearFavorites();
  mockGetStarred2.mockResolvedValue({ songs: [], albums: [], artists: [] });
});

describe('setOverride', () => {
  it('sets optimistic override for item', () => {
    favoritesStore.getState().setOverride('album-1', true);
    expect(favoritesStore.getState().overrides['album-1']).toBe(true);

    favoritesStore.getState().setOverride('album-1', false);
    expect(favoritesStore.getState().overrides['album-1']).toBe(false);
  });

  it('supports multiple overrides simultaneously', () => {
    favoritesStore.getState().setOverride('a', true);
    favoritesStore.getState().setOverride('b', false);
    favoritesStore.getState().setOverride('c', true);
    expect(favoritesStore.getState().overrides).toEqual({ a: true, b: false, c: true });
  });
});

describe('fetchStarred', () => {
  it('clears overrides on success', async () => {
    favoritesStore.getState().setOverride('album-1', true);
    expect(favoritesStore.getState().overrides['album-1']).toBe(true);

    await favoritesStore.getState().fetchStarred();

    expect(favoritesStore.getState().overrides).toEqual({});
  });

  it('populates songs, albums, artists from server response', async () => {
    mockGetStarred2.mockResolvedValue({
      songs: [{ id: 's1', title: 'Song', isDir: false }],
      albums: [{ id: 'a1', name: 'Album', created: new Date(), duration: 0, songCount: 0 }],
      artists: [{ id: 'ar1', name: 'Artist', albumCount: 0 }],
    });
    await favoritesStore.getState().fetchStarred();
    expect(favoritesStore.getState().songs).toHaveLength(1);
    expect(favoritesStore.getState().albums).toHaveLength(1);
    expect(favoritesStore.getState().artists).toHaveLength(1);
  });

  it('sets lastFetchedAt on success', async () => {
    expect(favoritesStore.getState().lastFetchedAt).toBeNull();
    await favoritesStore.getState().fetchStarred();
    expect(favoritesStore.getState().lastFetchedAt).toBeGreaterThan(0);
  });

  it('sets error and clears loading on API failure', async () => {
    mockGetStarred2.mockRejectedValue(new Error('Network error'));
    await favoritesStore.getState().fetchStarred();
    expect(favoritesStore.getState().loading).toBe(false);
    expect(favoritesStore.getState().error).toBe('Network error');
  });

  it('sets generic error for non-Error throws', async () => {
    mockGetStarred2.mockRejectedValue('some string');
    await favoritesStore.getState().fetchStarred();
    expect(favoritesStore.getState().error).toBe('Failed to load favorites');
  });

  it('prevents duplicate concurrent fetches', async () => {
    let callCount = 0;
    mockGetStarred2.mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 100));
      return { songs: [], albums: [], artists: [] };
    });
    // Both calls start while the first is still in-flight
    const p1 = favoritesStore.getState().fetchStarred();
    const p2 = favoritesStore.getState().fetchStarred();
    await Promise.all([p1, p2]);
    expect(callCount).toBe(1);
  });

  it('does not clear overrides on failure', async () => {
    favoritesStore.getState().setOverride('album-1', true);
    mockGetStarred2.mockRejectedValue(new Error('fail'));
    await favoritesStore.getState().fetchStarred();
    expect(favoritesStore.getState().overrides['album-1']).toBe(true);
  });
});

describe('applyLocalPlay', () => {
  const now = '2026-04-22T10:00:00.000Z';

  it('bumps starred song + starred album when both are present', () => {
    favoritesStore.setState({
      songs: [{ id: 's1', title: 'S1', playCount: 2 }] as any,
      albums: [{ id: 'a1', name: 'A1', playCount: 5 }] as any,
      artists: [],
    });

    favoritesStore.getState().applyLocalPlay('s1', 'a1', now);

    const after = favoritesStore.getState();
    expect((after.songs[0] as any).playCount).toBe(3);
    expect((after.songs[0] as any).played).toBe(now);
    expect((after.albums[0] as any).playCount).toBe(6);
    expect((after.albums[0] as any).played).toBe(now);
  });

  it('bumps only the song when the album is not starred', () => {
    favoritesStore.setState({
      songs: [{ id: 's1', title: 'S1' }] as any,
      albums: [],
      artists: [],
    });

    favoritesStore.getState().applyLocalPlay('s1', 'unknown-album', now);

    expect((favoritesStore.getState().songs[0] as any).playCount).toBe(1);
  });

  it('bumps only the album when the song is not starred', () => {
    favoritesStore.setState({
      songs: [],
      albums: [{ id: 'a1', name: 'A1' }] as any,
      artists: [],
    });

    favoritesStore.getState().applyLocalPlay('s1', 'a1', now);

    expect((favoritesStore.getState().albums[0] as any).playCount).toBe(1);
  });

  it('is a no-op when neither song nor album is starred', () => {
    favoritesStore.setState({ songs: [], albums: [], artists: [] });
    const before = favoritesStore.getState();

    favoritesStore.getState().applyLocalPlay('s1', 'a1', now);

    expect(favoritesStore.getState().songs).toBe(before.songs);
    expect(favoritesStore.getState().albums).toBe(before.albums);
  });

  it('skips the album side when albumId is undefined', () => {
    favoritesStore.setState({
      songs: [{ id: 's1', title: 'S1' }] as any,
      albums: [{ id: 'a1', name: 'A1' }] as any,
      artists: [],
    });
    const beforeAlbums = favoritesStore.getState().albums;

    favoritesStore.getState().applyLocalPlay('s1', undefined, now);

    expect((favoritesStore.getState().songs[0] as any).playCount).toBe(1);
    expect(favoritesStore.getState().albums).toBe(beforeAlbums);
  });
});
