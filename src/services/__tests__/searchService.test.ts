jest.mock('../subsonicService');
jest.mock('../../store/sqliteStorage', () => require('../../store/__mocks__/sqliteStorage'));
jest.mock('../imageCacheService', () => ({
  cacheAllSizes: jest.fn().mockResolvedValue(undefined),
  cacheEntityCoverArt: jest.fn(),
}));

import { ensureCoverArtAuth, search3 } from '../subsonicService';
import { albumDetailStore } from '../../store/albumDetailStore';
import { albumLibraryStore } from '../../store/albumLibraryStore';
import { favoritesStore } from '../../store/favoritesStore';
import { musicCacheStore } from '../../store/musicCacheStore';
import { playlistDetailStore } from '../../store/playlistDetailStore';
import { playlistLibraryStore } from '../../store/playlistLibraryStore';
import {
  performOnlineSearch,
  performOfflineSearch,
  getOfflineSongsByGenre,
} from '../searchService';

const mockSearch3 = search3 as jest.MockedFunction<typeof search3>;
const mockEnsureCoverArtAuth = ensureCoverArtAuth as jest.MockedFunction<typeof ensureCoverArtAuth>;

function resetStores() {
  musicCacheStore.setState({ cachedItems: {} } as any);
  albumLibraryStore.setState({ albums: [] });
  albumDetailStore.setState({ albums: {} });
  playlistLibraryStore.setState({ playlists: [] });
  playlistDetailStore.setState({ playlists: {} });
  favoritesStore.setState({ songs: [], albums: [], artists: [] } as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStores();
});

describe('performOnlineSearch', () => {
  it('calls ensureCoverArtAuth then search3', async () => {
    const results = {
      albums: [{ id: 'a1', name: 'Album' }],
      artists: [{ id: 'ar1', name: 'Artist' }],
      songs: [{ id: 's1', title: 'Song' }],
    };
    mockSearch3.mockResolvedValue(results as any);

    const result = await performOnlineSearch('test');

    expect(mockEnsureCoverArtAuth).toHaveBeenCalled();
    expect(mockSearch3).toHaveBeenCalledWith('test');
    expect(result).toEqual(results);
  });

  it('propagates errors from search3', async () => {
    mockSearch3.mockRejectedValue(new Error('Network error'));
    await expect(performOnlineSearch('test')).rejects.toThrow('Network error');
  });
});

describe('performOfflineSearch', () => {
  it('searches cached albums by name', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: { name: 'Test Album', coverArtId: 'c1', tracks: [] },
      },
    } as any);
    albumLibraryStore.setState({
      albums: [{ id: 'a1', name: 'Test Album', artist: 'Artist' }] as any,
    });

    const result = performOfflineSearch('test');

    expect(result.albums).toHaveLength(1);
    expect(result.albums[0].id).toBe('a1');
  });

  it('searches cached albums by artist name', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: { name: 'Album', coverArtId: 'c1', tracks: [] },
      },
    } as any);
    albumLibraryStore.setState({
      albums: [{ id: 'a1', name: 'Album', artist: 'Radiohead' }] as any,
    });

    const result = performOfflineSearch('radiohead');

    expect(result.albums).toHaveLength(1);
  });

  it('excludes non-cached albums', () => {
    musicCacheStore.setState({ cachedItems: {} } as any);
    albumLibraryStore.setState({
      albums: [{ id: 'a1', name: 'Test Album', artist: 'Artist' }] as any,
    });

    const result = performOfflineSearch('test');

    expect(result.albums).toHaveLength(0);
  });

  it('includes cached playlists as album-shaped results', () => {
    musicCacheStore.setState({
      cachedItems: {
        p1: { name: 'My Playlist', coverArtId: 'c1', tracks: [] },
      },
    } as any);
    albumLibraryStore.setState({ albums: [] });
    playlistLibraryStore.setState({
      playlists: [
        { id: 'p1', name: 'My Playlist', owner: 'user', coverArt: 'c1', songCount: 5, duration: 1000, created: '2024-01-01' },
      ] as any,
    });

    const result = performOfflineSearch('my');

    expect(result.albums.some((a) => a.id === 'p1')).toBe(true);
  });

  it('searches cached songs by title', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [
            { id: 't1', title: 'Matching Song', artist: 'Artist', duration: 200 },
            { id: 't2', title: 'Other', artist: 'Nobody', duration: 180 },
          ],
        },
      },
    } as any);

    const result = performOfflineSearch('matching');

    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].title).toBe('Matching Song');
  });

  it('searches cached songs by artist', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [
            { id: 't1', title: 'Song', artist: 'Radiohead', duration: 200 },
          ],
        },
      },
    } as any);

    const result = performOfflineSearch('radiohead');

    expect(result.songs).toHaveLength(1);
  });

  it('deduplicates songs by id', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [
            { id: 't1', title: 'Dup Song', artist: 'A', duration: 200 },
            { id: 't1', title: 'Dup Song', artist: 'A', duration: 200 },
          ],
        },
      },
    } as any);

    const result = performOfflineSearch('dup');

    expect(result.songs).toHaveLength(1);
  });

  it('uses cover art from playlistDetail over fallback', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'fallback-cover',
          tracks: [
            { id: 't1', title: 'Track One', artist: 'A', duration: 200 },
          ],
        },
      },
    } as any);
    playlistDetailStore.setState({
      playlists: {
        p1: { playlist: { entry: [{ id: 't1', coverArt: 'playlist-cover' }] } },
      },
    } as any);

    const result = performOfflineSearch('track');

    expect(result.songs[0].coverArt).toBe('playlist-cover');
  });

  it('falls back to cachedItem coverArtId when no detail cover art', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'fallback-cover',
          tracks: [
            { id: 't1', title: 'Track', artist: 'A', duration: 200 },
          ],
        },
      },
    } as any);

    const result = performOfflineSearch('track');

    expect(result.songs[0].coverArt).toBe('fallback-cover');
  });

  it('always returns empty artists array', () => {
    const result = performOfflineSearch('anything');
    expect(result.artists).toEqual([]);
  });

  it('returns empty results for no matches', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [
            { id: 't1', title: 'Song', artist: 'Artist', duration: 200 },
          ],
        },
      },
    } as any);
    albumLibraryStore.setState({
      albums: [{ id: 'a1', name: 'Album', artist: 'Artist' }] as any,
    });

    const result = performOfflineSearch('zzzznotfound');

    expect(result.albums).toHaveLength(0);
    expect(result.songs).toHaveLength(0);
  });

  it('handles album with undefined artist gracefully', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: { name: 'Album', coverArtId: 'c1', tracks: [] },
      },
    } as any);
    albumLibraryStore.setState({
      albums: [{ id: 'a1', name: 'Album' }] as any,
    });

    const result = performOfflineSearch('someartist');

    expect(result.albums).toHaveLength(0);
  });
});

describe('getOfflineSongsByGenre', () => {
  it('returns songs matching genre from album detail', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [
              { id: 't1', title: 'Song', artist: 'A', genre: 'Rock', isDir: false },
              { id: 't2', title: 'Other', artist: 'B', genre: 'Jazz', isDir: false },
            ],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('Rock');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('matches genre case-insensitively', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [{ id: 't1', title: 'Song', artist: 'A', genre: 'ROCK', isDir: false }],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('rock');

    expect(result).toHaveLength(1);
  });

  it('matches via genres array with {name} objects (OpenSubsonic)', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [
              { id: 't1', title: 'Song', artist: 'A', genres: [{ name: 'Electronic' }, { name: 'Ambient' }], isDir: false },
            ],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('ambient');

    expect(result).toHaveLength(1);
  });

  it('matches via genres array with plain strings (defensive)', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [
              { id: 't1', title: 'Song', artist: 'A', genres: ['Electronic', 'Ambient'], isDir: false },
            ],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('ambient');

    expect(result).toHaveLength(1);
  });

  it('excludes songs not in music cache', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [
              { id: 't1', title: 'Cached', artist: 'A', genre: 'Rock', isDir: false },
              { id: 't99', title: 'Not Cached', artist: 'B', genre: 'Rock', isDir: false },
            ],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('Rock');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('deduplicates songs across stores', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [{ id: 't1', title: 'Song', artist: 'A', genre: 'Rock', isDir: false, coverArt: 'ca1' }],
          },
        },
      },
    } as any);
    favoritesStore.setState({
      songs: [{ id: 't1', title: 'Song', artist: 'A', genre: 'Rock', isDir: false, coverArt: 'ca2' }],
    } as any);

    const result = getOfflineSongsByGenre('Rock');

    expect(result).toHaveLength(1);
  });

  it('includes songs from cached playlists', () => {
    musicCacheStore.setState({
      cachedItems: {
        p1: {
          name: 'Playlist',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    playlistDetailStore.setState({
      playlists: {
        p1: {
          playlist: {
            id: 'p1',
            entry: [{ id: 't1', title: 'Song', artist: 'A', genre: 'Pop', isDir: false }],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('Pop');

    expect(result).toHaveLength(1);
  });

  it('includes starred songs that are cached', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    favoritesStore.setState({
      songs: [{ id: 't1', title: 'Song', artist: 'A', genre: 'Blues', isDir: false }],
    } as any);

    const result = getOfflineSongsByGenre('Blues');

    expect(result).toHaveLength(1);
  });

  it('returns empty array when no songs match genre', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [{ id: 't1', title: 'Song', artist: 'A', genre: 'Rock', isDir: false }],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('Classical');

    expect(result).toHaveLength(0);
  });

  it('returns empty array when no cached items', () => {
    const result = getOfflineSongsByGenre('Rock');
    expect(result).toHaveLength(0);
  });

  it('only includes songs from cached album items', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Cached Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [{ id: 't1', title: 'Song', artist: 'A', genre: 'Rock', isDir: false }],
          },
        },
        a2: {
          album: {
            id: 'a2',
            song: [{ id: 't2', title: 'Other Song', artist: 'B', genre: 'Rock', isDir: false }],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('Rock');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  it('uses cover art from song when available', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [{ id: 't1', title: 'Song', artist: 'A', genre: 'Rock', isDir: false, coverArt: 'song-cover' }],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('Rock');

    expect(result[0].coverArt).toBe('song-cover');
  });

  it('falls back to trackCoverArtMap when song has no coverArt', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [{ id: 't1', title: 'Song', artist: 'A', genre: 'Rock', isDir: false }],
          },
        },
      },
    } as any);
    // The favorites store has cover art for t1
    favoritesStore.setState({
      songs: [{ id: 't1', coverArt: 'fav-cover' }],
    } as any);

    const result = getOfflineSongsByGenre('Rock');

    expect(result[0].coverArt).toBe('fav-cover');
  });

  it('does not match songs without genre or genres field', () => {
    musicCacheStore.setState({
      cachedItems: {
        a1: {
          name: 'Album',
          coverArtId: 'c1',
          tracks: [{ id: 't1', title: 'Song', artist: 'A', duration: 200 }],
        },
      },
    } as any);
    albumDetailStore.setState({
      albums: {
        a1: {
          album: {
            id: 'a1',
            song: [{ id: 't1', title: 'Song', artist: 'A', isDir: false }],
          },
        },
      },
    } as any);

    const result = getOfflineSongsByGenre('Rock');

    expect(result).toHaveLength(0);
  });
});
