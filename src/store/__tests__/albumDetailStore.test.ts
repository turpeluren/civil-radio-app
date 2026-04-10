jest.mock('../sqliteStorage', () => require('../__mocks__/sqliteStorage'));
jest.mock('../../services/subsonicService');
jest.mock('../../services/imageCacheService', () => ({
  cacheAllSizes: jest.fn().mockResolvedValue(undefined),
  cacheEntityCoverArt: jest.fn(),
}));

import { ensureCoverArtAuth, getAlbum } from '../../services/subsonicService';
import { albumDetailStore } from '../albumDetailStore';
import { ratingStore } from '../ratingStore';

const mockGetAlbum = getAlbum as jest.MockedFunction<typeof getAlbum>;

beforeEach(() => {
  jest.clearAllMocks();
  albumDetailStore.getState().clearAlbums();
  ratingStore.getState().clearOverrides();
});

describe('albumDetailStore', () => {
  describe('fetchAlbum', () => {
    it('fetches and stores album data', async () => {
      const album = { id: 'a1', name: 'Test Album', song: [] };
      mockGetAlbum.mockResolvedValue(album as any);

      const result = await albumDetailStore.getState().fetchAlbum('a1');

      expect(ensureCoverArtAuth).toHaveBeenCalled();
      expect(mockGetAlbum).toHaveBeenCalledWith('a1');
      expect(result).toBe(album);
      expect(albumDetailStore.getState().albums['a1'].album).toBe(album);
      expect(albumDetailStore.getState().albums['a1'].retrievedAt).toBeGreaterThan(0);
    });

    it('returns null when API returns null', async () => {
      mockGetAlbum.mockResolvedValue(null);

      const result = await albumDetailStore.getState().fetchAlbum('a1');

      expect(result).toBeNull();
      expect(albumDetailStore.getState().albums['a1']).toBeUndefined();
    });

    it('preserves existing albums when fetching new one', async () => {
      const album1 = { id: 'a1', name: 'Album 1', song: [] };
      const album2 = { id: 'a2', name: 'Album 2', song: [] };
      mockGetAlbum.mockResolvedValueOnce(album1 as any).mockResolvedValueOnce(album2 as any);

      await albumDetailStore.getState().fetchAlbum('a1');
      await albumDetailStore.getState().fetchAlbum('a2');

      expect(albumDetailStore.getState().albums['a1']).toBeDefined();
      expect(albumDetailStore.getState().albums['a2']).toBeDefined();
    });

    it('reconciles ratings for album and songs with userRating', async () => {
      ratingStore.getState().setOverride('a1', 3);
      ratingStore.getState().setOverride('s1', 2);
      const album = {
        id: 'a1',
        name: 'Rated Album',
        userRating: 5,
        song: [
          { id: 's1', title: 'Song 1', userRating: 4 },
          { id: 's2', title: 'Song 2', userRating: 0 },
        ],
      };
      mockGetAlbum.mockResolvedValue(album as any);

      await albumDetailStore.getState().fetchAlbum('a1');

      expect(ratingStore.getState().overrides['a1']!.rating).toBe(5);
      expect(ratingStore.getState().overrides['s1']!.rating).toBe(4);
      // s2 had no override, so none should be created
      expect(ratingStore.getState().overrides['s2']).toBeUndefined();
    });

    it('handles album with no song property', async () => {
      const album = { id: 'a1', name: 'No Songs' };
      mockGetAlbum.mockResolvedValue(album as any);

      const result = await albumDetailStore.getState().fetchAlbum('a1');

      expect(result).toBe(album);
      expect(albumDetailStore.getState().albums['a1'].album).toBe(album);
    });

    it('handles songs without userRating', async () => {
      ratingStore.getState().setOverride('s1', 3);
      const album = {
        id: 'a1',
        name: 'Album',
        song: [{ id: 's1', title: 'Song 1' }],
      };
      mockGetAlbum.mockResolvedValue(album as any);

      await albumDetailStore.getState().fetchAlbum('a1');

      // userRating undefined → defaults to 0, override was 3 → reconciled to 0
      expect(ratingStore.getState().overrides['s1']!.rating).toBe(0);
    });
  });

  describe('clearAlbums', () => {
    it('removes all cached albums', async () => {
      mockGetAlbum.mockResolvedValue({ id: 'a1', name: 'Test', song: [] } as any);
      await albumDetailStore.getState().fetchAlbum('a1');

      albumDetailStore.getState().clearAlbums();
      expect(albumDetailStore.getState().albums).toEqual({});
    });
  });
});
