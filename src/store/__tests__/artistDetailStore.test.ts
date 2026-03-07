const VARIOUS_ARTISTS_COVER_ART_ID = '__various_artists_cover__';

jest.mock('../../services/subsonicService', () => ({
  ensureCoverArtAuth: jest.fn().mockResolvedValue(undefined),
  getArtist: jest.fn().mockResolvedValue(null),
  getArtistInfo2: jest.fn().mockResolvedValue(null),
  getTopSongs: jest.fn().mockResolvedValue([]),
  isVariousArtists: (name: string | undefined) =>
    name?.trim().toLowerCase() === 'various artists',
  VARIOUS_ARTISTS_BIO:
    'Various Artists collects compilation albums, soundtracks, tribute records and other ' +
    'releases that feature songs from multiple artists.\n\n' +
    "Browse the albums below to discover what's in your collection.",
  VARIOUS_ARTISTS_COVER_ART_ID,
}));
jest.mock('../sqliteStorage', () => ({
  sqliteStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../mbidOverrideStore', () => ({
  mbidOverrideStore: { getState: jest.fn(() => ({ overrides: {} })) },
}));
jest.mock('../../services/musicbrainzService', () => ({
  getArtistBiography: jest.fn().mockResolvedValue(null),
  searchArtistMBID: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../utils/formatters', () => ({
  sanitizeBiographyText: jest.fn((text: string) => text),
}));

import {
  getArtist,
  getArtistInfo2,
  getTopSongs,
  VARIOUS_ARTISTS_BIO,
} from '../../services/subsonicService';
import { artistDetailStore } from '../artistDetailStore';

const mockGetArtist = getArtist as jest.MockedFunction<typeof getArtist>;
const mockGetArtistInfo2 = getArtistInfo2 as jest.MockedFunction<typeof getArtistInfo2>;
const mockGetTopSongs = getTopSongs as jest.MockedFunction<typeof getTopSongs>;

beforeEach(() => {
  jest.clearAllMocks();
  artistDetailStore.getState().clearArtists();
  mockGetArtist.mockResolvedValue(null);
  mockGetArtistInfo2.mockResolvedValue(null);
  mockGetTopSongs.mockResolvedValue([]);
});

describe('fetchArtist — Various Artists', () => {
  it('returns static entry with branded coverArt and bio', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'va-1',
      name: 'Various Artists',
      albumCount: 5,
      album: [],
    } as any);

    const entry = await artistDetailStore.getState().fetchArtist('va-1');

    expect(entry).not.toBeNull();
    expect(entry!.artist.coverArt).toBe(VARIOUS_ARTISTS_COVER_ART_ID);
    expect(entry!.biography).toBe(VARIOUS_ARTISTS_BIO);
    expect(entry!.topSongs).toEqual([]);
    expect(entry!.artistInfo).toBeNull();
    expect(entry!.resolvedMbid).toBeNull();
  });

  it('does not call getArtistInfo2 or getTopSongs for Various Artists', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'va-1',
      name: 'Various Artists',
      albumCount: 3,
      album: [],
    } as any);

    await artistDetailStore.getState().fetchArtist('va-1');

    expect(mockGetArtistInfo2).not.toHaveBeenCalled();
    expect(mockGetTopSongs).not.toHaveBeenCalled();
  });

  it('handles case-insensitive Various Artists name', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'va-1',
      name: 'various artists',
      albumCount: 1,
      album: [],
    } as any);

    const entry = await artistDetailStore.getState().fetchArtist('va-1');

    expect(entry).not.toBeNull();
    expect(entry!.artist.coverArt).toBe(VARIOUS_ARTISTS_COVER_ART_ID);
    expect(mockGetArtistInfo2).not.toHaveBeenCalled();
  });

  it('stores the entry in the artists map', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'va-1',
      name: 'Various Artists',
      albumCount: 2,
      album: [],
    } as any);

    await artistDetailStore.getState().fetchArtist('va-1');

    const stored = artistDetailStore.getState().artists['va-1'];
    expect(stored).toBeDefined();
    expect(stored.artist.coverArt).toBe(VARIOUS_ARTISTS_COVER_ART_ID);
  });
});

describe('fetchArtist — normal artist', () => {
  it('calls getArtistInfo2 and getTopSongs in parallel', async () => {
    mockGetArtist.mockResolvedValue({
      id: 'ar-1',
      name: 'Radiohead',
      albumCount: 9,
      album: [],
    } as any);
    mockGetArtistInfo2.mockResolvedValue({ biography: 'A band from Oxford.' } as any);
    mockGetTopSongs.mockResolvedValue([{ id: 's1', title: 'Creep' }] as any);

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry).not.toBeNull();
    expect(mockGetArtistInfo2).toHaveBeenCalledWith('ar-1');
    expect(mockGetTopSongs).toHaveBeenCalledWith('Radiohead', 20);
    expect(entry!.topSongs).toHaveLength(1);
    expect(entry!.biography).toBe('A band from Oxford.');
  });

  it('returns null when getArtist fails', async () => {
    mockGetArtist.mockResolvedValue(null);

    const entry = await artistDetailStore.getState().fetchArtist('ar-1');

    expect(entry).toBeNull();
    expect(mockGetArtistInfo2).not.toHaveBeenCalled();
    expect(mockGetTopSongs).not.toHaveBeenCalled();
  });
});
