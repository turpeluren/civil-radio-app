import {
  completedScrobbleStore,
  type AnalyticsAggregates,
  type CompletedScrobble,
  type ListeningStats,
} from '../completedScrobbleStore';

jest.mock('../sqliteStorage', () => require('../__mocks__/sqliteStorage'));

const EMPTY_STATS: ListeningStats = {
  totalPlays: 0,
  totalListeningSeconds: 0,
  uniqueArtists: {},
};

const EMPTY_AGGREGATES: AnalyticsAggregates = {
  artistCounts: {},
  albumCounts: {},
  songCounts: {},
  genreCounts: {},
  hourBuckets: new Array(24).fill(0),
  dayCounts: {},
};

function validScrobble(overrides?: Partial<CompletedScrobble>): CompletedScrobble {
  return {
    id: 'scrobble-1',
    song: { id: 's1', title: 'Song', artist: 'Artist', duration: 180 },
    time: Date.now(),
    ...overrides,
  } as CompletedScrobble;
}

function resetStore() {
  completedScrobbleStore.setState({
    completedScrobbles: [],
    stats: { ...EMPTY_STATS },
    aggregates: { ...EMPTY_AGGREGATES, hourBuckets: new Array(24).fill(0) },
  });
}

beforeEach(resetStore);

describe('addCompleted', () => {
  it('adds valid scrobble and increments stats', () => {
    const s = validScrobble();
    completedScrobbleStore.getState().addCompleted(s);

    const state = completedScrobbleStore.getState();
    expect(state.completedScrobbles).toHaveLength(1);
    expect(state.completedScrobbles[0]).toEqual(s);
    expect(state.stats.totalPlays).toBe(1);
    expect(state.stats.totalListeningSeconds).toBe(180);
    expect(state.stats.uniqueArtists).toEqual({ Artist: true });
  });

  it('rejects when id is missing', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '' }));
    expect(completedScrobbleStore.getState().completedScrobbles).toHaveLength(0);
  });

  it('rejects when song.id is missing', () => {
    completedScrobbleStore.getState().addCompleted(
      validScrobble({ song: { id: '', title: 'X', artist: 'A' } as any }),
    );
    expect(completedScrobbleStore.getState().completedScrobbles).toHaveLength(0);
  });

  it('rejects when song.title is missing', () => {
    completedScrobbleStore.getState().addCompleted(
      validScrobble({ song: { id: 's1', title: '', artist: 'A' } as any }),
    );
    expect(completedScrobbleStore.getState().completedScrobbles).toHaveLength(0);
  });

  it('rejects duplicates by id', () => {
    const s = validScrobble();
    completedScrobbleStore.getState().addCompleted(s);
    completedScrobbleStore.getState().addCompleted(s);
    expect(completedScrobbleStore.getState().completedScrobbles).toHaveLength(1);
  });

  it('handles missing duration', () => {
    completedScrobbleStore.getState().addCompleted(
      validScrobble({ song: { id: 's1', title: 'X', artist: 'A' } as any }),
    );
    expect(completedScrobbleStore.getState().stats.totalListeningSeconds).toBe(0);
  });

  it('handles missing artist', () => {
    completedScrobbleStore.getState().addCompleted(
      validScrobble({ song: { id: 's1', title: 'X' } as any }),
    );
    expect(completedScrobbleStore.getState().stats.uniqueArtists).toEqual({});
  });

  it('tracks multiple unique artists', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', song: { id: 's1', title: 'A', artist: 'Artist1', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '2', song: { id: 's2', title: 'B', artist: 'Artist2', duration: 200 } as any }));
    expect(completedScrobbleStore.getState().stats.uniqueArtists).toEqual({
      Artist1: true,
      Artist2: true,
    });
  });

  it('rejects when song is null', () => {
    completedScrobbleStore.getState().addCompleted(
      { id: 'x', song: null as any, time: Date.now() } as CompletedScrobble,
    );
    expect(completedScrobbleStore.getState().completedScrobbles).toHaveLength(0);
  });

  it('accumulates stats correctly over many adds', () => {
    for (let i = 0; i < 10; i++) {
      completedScrobbleStore.getState().addCompleted(
        validScrobble({
          id: `s-${i}`,
          song: { id: `song-${i}`, title: `T${i}`, artist: `A${i % 3}`, duration: 100 } as any,
        }),
      );
    }
    const { stats } = completedScrobbleStore.getState();
    expect(stats.totalPlays).toBe(10);
    expect(stats.totalListeningSeconds).toBe(1000);
    expect(Object.keys(stats.uniqueArtists)).toHaveLength(3);
  });
});

describe('aggregates – incremental updates', () => {
  it('updates artistCounts incrementally', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', song: { id: 's1', title: 'A', artist: 'ArtistX', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '2', song: { id: 's2', title: 'B', artist: 'ArtistX', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '3', song: { id: 's3', title: 'C', artist: 'ArtistY', duration: 100 } as any }));

    const { aggregates } = completedScrobbleStore.getState();
    expect(aggregates.artistCounts['ArtistX']).toBe(2);
    expect(aggregates.artistCounts['ArtistY']).toBe(1);
  });

  it('updates albumCounts incrementally', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', song: { id: 's1', title: 'A', artist: 'Art', album: 'AlbumA', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '2', song: { id: 's2', title: 'B', artist: 'Art', album: 'AlbumA', duration: 100 } as any }));

    const { aggregates } = completedScrobbleStore.getState();
    expect(aggregates.albumCounts['AlbumA::Art'].count).toBe(2);
    expect(aggregates.albumCounts['AlbumA::Art'].artist).toBe('Art');
  });

  it('updates songCounts incrementally and keeps latest song metadata', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', song: { id: 's1', title: 'Old Title', artist: 'Art', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '2', song: { id: 's1', title: 'New Title', artist: 'Art', duration: 100 } as any }));

    const { aggregates } = completedScrobbleStore.getState();
    expect(aggregates.songCounts['s1'].count).toBe(2);
    expect(aggregates.songCounts['s1'].song.title).toBe('New Title');
  });

  it('updates genreCounts incrementally', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', song: { id: 's1', title: 'A', artist: 'Art', genre: 'Rock', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '2', song: { id: 's2', title: 'B', artist: 'Art', genre: 'Rock', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '3', song: { id: 's3', title: 'C', artist: 'Art', genre: 'Jazz', duration: 100 } as any }));

    const { aggregates } = completedScrobbleStore.getState();
    expect(aggregates.genreCounts['Rock']).toBe(2);
    expect(aggregates.genreCounts['Jazz']).toBe(1);
  });

  it('updates hourBuckets incrementally', () => {
    const time = new Date(2025, 0, 15, 14, 30).getTime();
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', time, song: { id: 's1', title: 'A', artist: 'Art', duration: 100 } as any }));

    const { aggregates } = completedScrobbleStore.getState();
    expect(aggregates.hourBuckets[14]).toBe(1);
    expect(aggregates.hourBuckets.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('updates dayCounts incrementally', () => {
    const time1 = new Date(2025, 0, 15, 10).getTime();
    const time2 = new Date(2025, 0, 15, 14).getTime();
    const time3 = new Date(2025, 0, 16, 10).getTime();
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', time: time1, song: { id: 's1', title: 'A', artist: 'Art', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '2', time: time2, song: { id: 's2', title: 'B', artist: 'Art', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '3', time: time3, song: { id: 's3', title: 'C', artist: 'Art', duration: 100 } as any }));

    const { aggregates } = completedScrobbleStore.getState();
    expect(aggregates.dayCounts['2025-01-15']).toBe(2);
    expect(aggregates.dayCounts['2025-01-16']).toBe(1);
  });

  it('handles missing artist by using Unknown', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', song: { id: 's1', title: 'A' } as any }));

    const { aggregates } = completedScrobbleStore.getState();
    expect(aggregates.artistCounts['Unknown']).toBe(1);
  });

  it('does not update aggregates on rejected scrobble', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '' }));
    const { aggregates } = completedScrobbleStore.getState();
    expect(Object.keys(aggregates.artistCounts)).toHaveLength(0);
    expect(Object.keys(aggregates.songCounts)).toHaveLength(0);
  });

  it('incremental aggregates match full rebuild', () => {
    for (let i = 0; i < 10; i++) {
      completedScrobbleStore.getState().addCompleted(
        validScrobble({
          id: `s-${i}`,
          song: { id: `song-${i % 3}`, title: `T${i}`, artist: `A${i % 2}`, album: `Alb${i % 4}`, genre: i % 2 === 0 ? 'Rock' : 'Jazz', duration: 100 } as any,
          time: new Date(2025, 0, 10 + (i % 5), i % 24).getTime(),
        }),
      );
    }
    const incrementalAgg = completedScrobbleStore.getState().aggregates;

    completedScrobbleStore.setState({ aggregates: { ...EMPTY_AGGREGATES, hourBuckets: new Array(24).fill(0) } });
    completedScrobbleStore.getState().rebuildAggregates();
    const rebuiltAgg = completedScrobbleStore.getState().aggregates;

    expect(incrementalAgg.artistCounts).toEqual(rebuiltAgg.artistCounts);
    expect(incrementalAgg.albumCounts).toEqual(rebuiltAgg.albumCounts);
    expect(incrementalAgg.genreCounts).toEqual(rebuiltAgg.genreCounts);
    expect(incrementalAgg.hourBuckets).toEqual(rebuiltAgg.hourBuckets);
    expect(incrementalAgg.dayCounts).toEqual(rebuiltAgg.dayCounts);
    // songCounts: compare counts (song metadata may differ since rebuild uses last occurrence)
    for (const key of Object.keys(rebuiltAgg.songCounts)) {
      expect(incrementalAgg.songCounts[key].count).toBe(rebuiltAgg.songCounts[key].count);
    }
  });
});

describe('rebuildStats', () => {
  it('recomputes stats from scrobbles', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', song: { id: 's1', title: 'A', artist: 'A', duration: 100 } as any }));
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '2', song: { id: 's2', title: 'B', artist: 'B', duration: 200 } as any }));

    completedScrobbleStore.setState({ stats: EMPTY_STATS });
    completedScrobbleStore.getState().rebuildStats();

    const { stats } = completedScrobbleStore.getState();
    expect(stats.totalPlays).toBe(2);
    expect(stats.totalListeningSeconds).toBe(300);
    expect(stats.uniqueArtists).toEqual({ A: true, B: true });
  });

  it('rebuild is idempotent', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', song: { id: 's1', title: 'A', artist: 'A', duration: 100 } as any }));
    const statsAfterAdd = { ...completedScrobbleStore.getState().stats };
    completedScrobbleStore.getState().rebuildStats();
    const statsAfterRebuild = completedScrobbleStore.getState().stats;
    expect(statsAfterRebuild).toEqual(statsAfterAdd);
  });

  it('rebuild matches incremental stats exactly', () => {
    for (let i = 0; i < 5; i++) {
      completedScrobbleStore.getState().addCompleted(
        validScrobble({
          id: `s-${i}`,
          song: { id: `song-${i}`, title: `T${i}`, artist: `A${i % 2}`, duration: 50 * (i + 1) } as any,
        }),
      );
    }
    const incrementalStats = { ...completedScrobbleStore.getState().stats };
    completedScrobbleStore.setState({ stats: EMPTY_STATS });
    completedScrobbleStore.getState().rebuildStats();
    expect(completedScrobbleStore.getState().stats).toEqual(incrementalStats);
  });
});

describe('rebuildAggregates', () => {
  it('rebuilds all aggregate fields from scrobbles', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({
      id: '1',
      song: { id: 's1', title: 'A', artist: 'Art', album: 'Alb', genre: 'Rock', duration: 100 } as any,
      time: new Date(2025, 0, 15, 10).getTime(),
    }));
    completedScrobbleStore.getState().addCompleted(validScrobble({
      id: '2',
      song: { id: 's2', title: 'B', artist: 'Art', album: 'Alb', genre: 'Jazz', duration: 200 } as any,
      time: new Date(2025, 0, 15, 14).getTime(),
    }));

    completedScrobbleStore.setState({ aggregates: { ...EMPTY_AGGREGATES, hourBuckets: new Array(24).fill(0) } });
    completedScrobbleStore.getState().rebuildAggregates();

    const { aggregates } = completedScrobbleStore.getState();
    expect(aggregates.artistCounts['Art']).toBe(2);
    expect(aggregates.albumCounts['Alb::Art'].count).toBe(2);
    expect(aggregates.songCounts['s1'].count).toBe(1);
    expect(aggregates.songCounts['s2'].count).toBe(1);
    expect(aggregates.genreCounts['Rock']).toBe(1);
    expect(aggregates.genreCounts['Jazz']).toBe(1);
    expect(aggregates.hourBuckets[10]).toBe(1);
    expect(aggregates.hourBuckets[14]).toBe(1);
    expect(aggregates.dayCounts['2025-01-15']).toBe(2);
  });

  it('is idempotent', () => {
    completedScrobbleStore.getState().addCompleted(validScrobble({ id: '1', song: { id: 's1', title: 'A', artist: 'Art', duration: 100 } as any }));
    const aggAfterAdd = { ...completedScrobbleStore.getState().aggregates };
    completedScrobbleStore.getState().rebuildAggregates();
    const aggAfterRebuild = completedScrobbleStore.getState().aggregates;
    expect(aggAfterRebuild.artistCounts).toEqual(aggAfterAdd.artistCounts);
    expect(aggAfterRebuild.dayCounts).toEqual(aggAfterAdd.dayCounts);
  });
});

describe('onRehydrateStorage', () => {
  it('deduplicates scrobbles with same id and rebuilds stats', () => {
    const duped: CompletedScrobble[] = [
      validScrobble({ id: 'a', song: { id: 's1', title: 'X', artist: 'A', duration: 100 } as any }),
      validScrobble({ id: 'a', song: { id: 's1', title: 'X', artist: 'A', duration: 100 } as any }),
      validScrobble({ id: 'b', song: { id: 's2', title: 'Y', artist: 'B', duration: 200 } as any }),
    ];
    completedScrobbleStore.setState({
      completedScrobbles: duped,
      stats: { totalPlays: 3, totalListeningSeconds: 400, uniqueArtists: { A: true, B: true } },
      aggregates: { ...EMPTY_AGGREGATES, hourBuckets: new Array(24).fill(0) },
    });
    // Trigger rehydrate callback
    completedScrobbleStore.persist.rehydrate();
    const state = completedScrobbleStore.getState();
    expect(state.completedScrobbles).toHaveLength(2);
    expect(state.stats.totalPlays).toBe(2);
    expect(state.stats.totalListeningSeconds).toBe(300);
  });

  it('removes scrobbles with missing id or song fields', () => {
    const dirty = [
      validScrobble({ id: 'ok', song: { id: 's1', title: 'X', artist: 'A', duration: 100 } as any }),
      { id: '', song: { id: 's2', title: 'Y' }, time: Date.now() } as CompletedScrobble,
      { id: 'bad-song', song: { id: '', title: 'Z' }, time: Date.now() } as CompletedScrobble,
      { id: 'no-title', song: { id: 's3', title: '' }, time: Date.now() } as CompletedScrobble,
    ];
    completedScrobbleStore.setState({
      completedScrobbles: dirty,
      stats: { totalPlays: 4, totalListeningSeconds: 0, uniqueArtists: {} },
      aggregates: { ...EMPTY_AGGREGATES, hourBuckets: new Array(24).fill(0) },
    });
    completedScrobbleStore.persist.rehydrate();
    expect(completedScrobbleStore.getState().completedScrobbles).toHaveLength(1);
    expect(completedScrobbleStore.getState().stats.totalPlays).toBe(1);
  });

  it('rebuilds stats when totalPlays is 0 but scrobbles exist', () => {
    completedScrobbleStore.setState({
      completedScrobbles: [
        validScrobble({ id: 'a', song: { id: 's1', title: 'X', artist: 'A', duration: 100 } as any }),
      ],
      stats: { ...EMPTY_STATS },
      aggregates: { ...EMPTY_AGGREGATES, hourBuckets: new Array(24).fill(0) },
    });
    completedScrobbleStore.persist.rehydrate();
    expect(completedScrobbleStore.getState().stats.totalPlays).toBe(1);
    expect(completedScrobbleStore.getState().stats.totalListeningSeconds).toBe(100);
  });

  it('does not rebuild when stats are already correct', () => {
    const scrobble = validScrobble({ id: 'a', song: { id: 's1', title: 'X', artist: 'A', duration: 100 } as any });
    completedScrobbleStore.setState({
      completedScrobbles: [scrobble],
      stats: { totalPlays: 1, totalListeningSeconds: 100, uniqueArtists: { A: true } },
      aggregates: { artistCounts: { A: 1 }, albumCounts: {}, songCounts: { s1: { song: scrobble.song, count: 1 } }, genreCounts: {}, hourBuckets: new Array(24).fill(0), dayCounts: { '2025-01-15': 1 } },
    });
    completedScrobbleStore.persist.rehydrate();
    const statsAfter = completedScrobbleStore.getState().stats;
    expect(statsAfter.totalPlays).toBe(1);
    expect(statsAfter.totalListeningSeconds).toBe(100);
  });

  it('rebuilds aggregates when dayCounts is missing (upgrade path)', () => {
    const scrobble = validScrobble({
      id: 'a',
      song: { id: 's1', title: 'X', artist: 'A', duration: 100 } as any,
      time: new Date(2025, 0, 15, 10).getTime(),
    });
    completedScrobbleStore.setState({
      completedScrobbles: [scrobble],
      stats: { totalPlays: 1, totalListeningSeconds: 100, uniqueArtists: { A: true } },
      aggregates: { ...EMPTY_AGGREGATES, hourBuckets: new Array(24).fill(0) },
    });
    completedScrobbleStore.persist.rehydrate();
    const { aggregates } = completedScrobbleStore.getState();
    expect(aggregates.dayCounts['2025-01-15']).toBe(1);
    expect(aggregates.artistCounts['A']).toBe(1);
  });
});
