import {
  albumPassesDownloadedFilter,
  computeQueueItemProgress,
  isCompleteAlbum,
  isPartialAlbum,
} from '../cachedItemHelpers';
import type {
  CachedItemRow,
  DownloadQueueRow,
} from '../musicCacheTables';

function makeItem(overrides: Partial<CachedItemRow> = {}): CachedItemRow {
  return {
    itemId: 'a1',
    type: 'album',
    name: 'A',
    expectedSongCount: 10,
    lastSyncAt: 0,
    downloadedAt: 0,
    songIds: [],
    ...overrides,
  };
}

function makeQueue(overrides: Partial<DownloadQueueRow> = {}): DownloadQueueRow {
  return {
    queueId: 'q',
    itemId: 'a1',
    type: 'album',
    name: 'A',
    status: 'downloading',
    totalSongs: 10,
    completedSongs: 0,
    addedAt: 0,
    queuePosition: 1,
    songsJson: '[]',
    ...overrides,
  };
}

describe('isPartialAlbum', () => {
  it('returns false for non-album types', () => {
    expect(isPartialAlbum(makeItem({ type: 'playlist', songIds: ['s1'], expectedSongCount: 10 }))).toBe(false);
    expect(isPartialAlbum(makeItem({ type: 'song', songIds: ['s1'], expectedSongCount: 10 }))).toBe(false);
    expect(isPartialAlbum(makeItem({ type: 'favorites', songIds: [], expectedSongCount: 10 }))).toBe(false);
  });

  it('returns true when songs on disk < expected', () => {
    expect(isPartialAlbum(makeItem({ songIds: ['s1', 's2'], expectedSongCount: 10 }))).toBe(true);
  });

  it('returns false when songs on disk == expected', () => {
    expect(isPartialAlbum(makeItem({
      songIds: Array.from({ length: 10 }, (_, i) => `s${i}`),
      expectedSongCount: 10,
    }))).toBe(false);
  });

  it('defensive: treats expectedSongCount == 1 with at least 1 song as partial (fallback correction)', () => {
    // ensurePartialAlbumEdge sets expectedSongCount = 1 as a fallback when
    // albumDetailStore has no cached entry. Classifying such a row as
    // "complete" would strand the user's ability to top up. Prefer false-
    // positive partial; top-up will refetch and self-correct.
    expect(isPartialAlbum(makeItem({ songIds: ['s1'], expectedSongCount: 1 }))).toBe(true);
  });

  it('defensive: expectedSongCount 0 with 0 songs is NOT partial (empty album edge case)', () => {
    expect(isPartialAlbum(makeItem({ songIds: [], expectedSongCount: 0 }))).toBe(false);
  });
});

describe('isCompleteAlbum', () => {
  it('true only for albums that are not partial', () => {
    expect(isCompleteAlbum(makeItem({
      songIds: Array.from({ length: 10 }, (_, i) => `s${i}`),
      expectedSongCount: 10,
    }))).toBe(true);
    expect(isCompleteAlbum(makeItem({ songIds: ['s1'], expectedSongCount: 10 }))).toBe(false);
    expect(isCompleteAlbum(makeItem({ type: 'playlist' }))).toBe(false);
  });
});

describe('albumPassesDownloadedFilter', () => {
  const complete = makeItem({
    itemId: 'a1',
    songIds: Array.from({ length: 10 }, (_, i) => `s${i}`),
    expectedSongCount: 10,
  });
  const partial = makeItem({
    itemId: 'a2',
    songIds: ['s1', 's2'],
    expectedSongCount: 10,
  });

  it('returns false when album has no cached entry', () => {
    expect(albumPassesDownloadedFilter({ id: 'nonexistent' }, {}, true)).toBe(false);
    expect(albumPassesDownloadedFilter({ id: 'nonexistent' }, {}, false)).toBe(false);
  });

  it('returns true for fully-downloaded album regardless of toggle', () => {
    const map = { a1: complete };
    expect(albumPassesDownloadedFilter({ id: 'a1' }, map, false)).toBe(true);
    expect(albumPassesDownloadedFilter({ id: 'a1' }, map, true)).toBe(true);
  });

  it('excludes partial album when includePartial is false', () => {
    const map = { a2: partial };
    expect(albumPassesDownloadedFilter({ id: 'a2' }, map, false)).toBe(false);
  });

  it('includes partial album when includePartial is true', () => {
    const map = { a2: partial };
    expect(albumPassesDownloadedFilter({ id: 'a2' }, map, true)).toBe(true);
  });
});

describe('computeQueueItemProgress', () => {
  it('falls back to queue-row progress when itemId has no cachedItems entry (fresh download)', () => {
    const p = computeQueueItemProgress(makeQueue({ completedSongs: 3, totalSongs: 10 }), {});
    expect(p).toEqual({ completed: 3, total: 10 });
  });

  it('reports album-level progress for a top-up: existing + delta / expectedSongCount', () => {
    const cachedItems = {
      a1: makeItem({ itemId: 'a1', songIds: ['s1', 's2', 's3', 's4', 's5'], expectedSongCount: 10 }),
    };
    const queue = makeQueue({ itemId: 'a1', completedSongs: 3, totalSongs: 5 });
    expect(computeQueueItemProgress(queue, cachedItems)).toEqual({ completed: 8, total: 10 });
  });

  it('reports 5/10 at start of top-up when completedSongs is 0', () => {
    const cachedItems = {
      a1: makeItem({ itemId: 'a1', songIds: ['s1', 's2', 's3', 's4', 's5'], expectedSongCount: 10 }),
    };
    const queue = makeQueue({ itemId: 'a1', completedSongs: 0, totalSongs: 5 });
    expect(computeQueueItemProgress(queue, cachedItems)).toEqual({ completed: 5, total: 10 });
  });
});
