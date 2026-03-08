import {
  musicCacheStore,
  type CachedMusicItem,
  type CachedTrack,
} from '../musicCacheStore';

jest.mock('../sqliteStorage', () => require('../__mocks__/sqliteStorage'));

function makeQueueItem(overrides?: Partial<{ itemId: string; name: string }>) {
  return {
    itemId: 'album-1',
    type: 'album' as const,
    name: 'Album',
    tracks: [{ id: 's1', title: 'Song', artist: 'A', isDir: false }],
    totalTracks: 1,
    ...overrides,
  };
}

function makeCachedItem(itemId: string, tracks: CachedTrack[]): CachedMusicItem {
  const totalBytes = tracks.reduce((s, t) => s + t.bytes, 0);
  return {
    itemId,
    type: 'album',
    name: 'Album',
    tracks,
    totalBytes,
    downloadedAt: Date.now(),
  };
}

beforeEach(() => {
  musicCacheStore.getState().reset();
});

describe('enqueue', () => {
  it('adds item with generated queueId', () => {
    musicCacheStore.getState().enqueue(makeQueueItem());
    const { downloadQueue } = musicCacheStore.getState();
    expect(downloadQueue).toHaveLength(1);
    expect(downloadQueue[0].queueId).toMatch(/^\d+-[a-z0-9]+$/);
    expect(downloadQueue[0].status).toBe('queued');
    expect(downloadQueue[0].itemId).toBe('album-1');
  });

  it('skips duplicate itemId in queue', () => {
    musicCacheStore.getState().enqueue(makeQueueItem());
    musicCacheStore.getState().enqueue(makeQueueItem());
    expect(musicCacheStore.getState().downloadQueue).toHaveLength(1);
  });

  it('skips when itemId already cached', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
    ]);
    musicCacheStore.setState({ cachedItems: { 'album-1': cached } });
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'album-1' }));
    expect(musicCacheStore.getState().downloadQueue).toHaveLength(0);
  });
});

describe('markItemComplete', () => {
  it('moves item from queue to cachedItems', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'album-1' }));
    const queueId = musicCacheStore.getState().downloadQueue[0].queueId;
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
    ]);

    musicCacheStore.getState().markItemComplete(queueId, cached);

    expect(musicCacheStore.getState().downloadQueue).toHaveLength(0);
    expect(musicCacheStore.getState().cachedItems['album-1']).toEqual(cached);
  });
});

describe('removeCachedItem', () => {
  it('removes item and adjusts totals', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
    ]);
    musicCacheStore.setState({
      cachedItems: { 'album-1': cached },
      totalBytes: 100,
      totalFiles: 1,
    });

    musicCacheStore.getState().removeCachedItem('album-1');

    expect(musicCacheStore.getState().cachedItems['album-1']).toBeUndefined();
    expect(musicCacheStore.getState().totalBytes).toBe(0);
    expect(musicCacheStore.getState().totalFiles).toBe(0);
  });
});

describe('reorderQueue', () => {
  it('reorders items correctly', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'a', name: 'A' }));
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'b', name: 'B' }));
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'c', name: 'C' }));
    const ids = () => musicCacheStore.getState().downloadQueue.map((q) => q.itemId);

    musicCacheStore.getState().reorderQueue(0, 2);

    expect(ids()).toEqual(['b', 'c', 'a']);
  });
});

describe('removeFromQueue', () => {
  it('removes by queueId', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'a' }));
    const queueId = musicCacheStore.getState().downloadQueue[0].queueId;

    musicCacheStore.getState().removeFromQueue(queueId);

    expect(musicCacheStore.getState().downloadQueue).toHaveLength(0);
  });

  it('is a no-op for nonexistent queueId', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'a' }));
    musicCacheStore.getState().removeFromQueue('nonexistent');
    expect(musicCacheStore.getState().downloadQueue).toHaveLength(1);
  });
});

describe('reorderQueue edge cases', () => {
  it('is a no-op for out-of-bounds fromIndex', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'a', name: 'A' }));
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'b', name: 'B' }));
    const before = musicCacheStore.getState().downloadQueue.map((q) => q.itemId);
    musicCacheStore.getState().reorderQueue(-1, 1);
    expect(musicCacheStore.getState().downloadQueue.map((q) => q.itemId)).toEqual(before);
  });

  it('is a no-op for out-of-bounds toIndex', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'a', name: 'A' }));
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'b', name: 'B' }));
    const before = musicCacheStore.getState().downloadQueue.map((q) => q.itemId);
    musicCacheStore.getState().reorderQueue(0, 99);
    expect(musicCacheStore.getState().downloadQueue.map((q) => q.itemId)).toEqual(before);
  });

  it('is a no-op when fromIndex === toIndex', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'a', name: 'A' }));
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'b', name: 'B' }));
    const before = musicCacheStore.getState().downloadQueue.map((q) => q.itemId);
    musicCacheStore.getState().reorderQueue(0, 0);
    expect(musicCacheStore.getState().downloadQueue.map((q) => q.itemId)).toEqual(before);
  });
});

describe('removeCachedItem edge cases', () => {
  it('is a no-op for nonexistent item', () => {
    musicCacheStore.setState({ totalBytes: 100, totalFiles: 1 });
    musicCacheStore.getState().removeCachedItem('nonexistent');
    expect(musicCacheStore.getState().totalBytes).toBe(100);
    expect(musicCacheStore.getState().totalFiles).toBe(1);
  });

  it('clamps totalBytes to 0 when removing item with more bytes than total', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S', artist: 'A', fileName: 's1.mp3', bytes: 500, duration: 180 },
    ]);
    musicCacheStore.setState({ cachedItems: { 'album-1': cached }, totalBytes: 100, totalFiles: 1 });
    musicCacheStore.getState().removeCachedItem('album-1');
    expect(musicCacheStore.getState().totalBytes).toBe(0);
    expect(musicCacheStore.getState().totalFiles).toBe(0);
  });
});

describe('updateCachedTrack', () => {
  it('replaces track and adjusts byte totals', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S1', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
      { id: 's2', title: 'S2', artist: 'A', fileName: 's2.mp3', bytes: 200, duration: 240 },
    ]);
    musicCacheStore.setState({ cachedItems: { 'album-1': cached }, totalBytes: 300, totalFiles: 2 });
    const newTrack: CachedTrack = { id: 's1', title: 'S1-new', artist: 'A', fileName: 's1.mp3', bytes: 150, duration: 180 };
    musicCacheStore.getState().updateCachedTrack('album-1', 0, newTrack, 100);
    const updated = musicCacheStore.getState().cachedItems['album-1'];
    expect(updated.tracks[0].title).toBe('S1-new');
    expect(updated.totalBytes).toBe(350);
    expect(musicCacheStore.getState().totalBytes).toBe(350);
  });

  it('is a no-op for nonexistent item', () => {
    const newTrack: CachedTrack = { id: 's1', title: 'S1', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 };
    musicCacheStore.getState().updateCachedTrack('nonexistent', 0, newTrack, 100);
    expect(musicCacheStore.getState().cachedItems['nonexistent']).toBeUndefined();
  });

  it('is a no-op for out-of-bounds trackIndex', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S1', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
    ]);
    musicCacheStore.setState({ cachedItems: { 'album-1': cached }, totalBytes: 100 });
    const newTrack: CachedTrack = { id: 's1', title: 'S1', artist: 'A', fileName: 's1.mp3', bytes: 200, duration: 180 };
    musicCacheStore.getState().updateCachedTrack('album-1', 5, newTrack, 100);
    expect(musicCacheStore.getState().totalBytes).toBe(100);
  });
});

describe('removeCachedTrack', () => {
  it('removes track and adjusts totals', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S1', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
      { id: 's2', title: 'S2', artist: 'A', fileName: 's2.mp3', bytes: 200, duration: 240 },
    ]);
    musicCacheStore.setState({ cachedItems: { 'album-1': cached }, totalBytes: 300, totalFiles: 2 });
    musicCacheStore.getState().removeCachedTrack('album-1', 0);
    const updated = musicCacheStore.getState().cachedItems['album-1'];
    expect(updated.tracks).toHaveLength(1);
    expect(updated.tracks[0].id).toBe('s2');
    expect(updated.totalBytes).toBe(200);
    expect(musicCacheStore.getState().totalBytes).toBe(200);
    expect(musicCacheStore.getState().totalFiles).toBe(1);
  });

  it('is a no-op for out-of-bounds index', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S1', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
    ]);
    musicCacheStore.setState({ cachedItems: { 'album-1': cached }, totalBytes: 100, totalFiles: 1 });
    musicCacheStore.getState().removeCachedTrack('album-1', -1);
    expect(musicCacheStore.getState().totalFiles).toBe(1);
    musicCacheStore.getState().removeCachedTrack('album-1', 5);
    expect(musicCacheStore.getState().totalFiles).toBe(1);
  });
});

describe('addBytes and addFiles', () => {
  it('increments totalBytes', () => {
    musicCacheStore.getState().addBytes(500);
    musicCacheStore.getState().addBytes(300);
    expect(musicCacheStore.getState().totalBytes).toBe(800);
  });

  it('increments totalFiles', () => {
    musicCacheStore.getState().addFiles(1);
    musicCacheStore.getState().addFiles(2);
    expect(musicCacheStore.getState().totalFiles).toBe(3);
  });
});

describe('reorderCachedTracks', () => {
  it('reorders tracks within a cached item', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S1', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
      { id: 's2', title: 'S2', artist: 'A', fileName: 's2.mp3', bytes: 200, duration: 240 },
      { id: 's3', title: 'S3', artist: 'A', fileName: 's3.mp3', bytes: 300, duration: 300 },
    ]);
    musicCacheStore.setState({ cachedItems: { 'album-1': cached } });
    musicCacheStore.getState().reorderCachedTracks('album-1', 0, 2);
    const ids = musicCacheStore.getState().cachedItems['album-1'].tracks.map((t) => t.id);
    expect(ids).toEqual(['s2', 's3', 's1']);
  });

  it('is a no-op for nonexistent item', () => {
    musicCacheStore.getState().reorderCachedTracks('nonexistent', 0, 1);
    expect(musicCacheStore.getState().cachedItems['nonexistent']).toBeUndefined();
  });

  it('is a no-op for out-of-bounds indices', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S1', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
    ]);
    musicCacheStore.setState({ cachedItems: { 'album-1': cached } });
    musicCacheStore.getState().reorderCachedTracks('album-1', -1, 0);
    expect(musicCacheStore.getState().cachedItems['album-1'].tracks[0].id).toBe('s1');
    musicCacheStore.getState().reorderCachedTracks('album-1', 0, 99);
    expect(musicCacheStore.getState().cachedItems['album-1'].tracks[0].id).toBe('s1');
  });

  it('is a no-op when fromIndex equals toIndex', () => {
    const cached = makeCachedItem('album-1', [
      { id: 's1', title: 'S1', artist: 'A', fileName: 's1.mp3', bytes: 100, duration: 180 },
      { id: 's2', title: 'S2', artist: 'A', fileName: 's2.mp3', bytes: 200, duration: 240 },
    ]);
    musicCacheStore.setState({ cachedItems: { 'album-1': cached } });
    musicCacheStore.getState().reorderCachedTracks('album-1', 0, 0);
    expect(musicCacheStore.getState().cachedItems['album-1'].tracks.map((t) => t.id)).toEqual(['s1', 's2']);
  });
});

describe('updateQueueItem', () => {
  it('updates status and completedTracks', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'a' }));
    const queueId = musicCacheStore.getState().downloadQueue[0].queueId;
    musicCacheStore.getState().updateQueueItem(queueId, { status: 'downloading', completedTracks: 1 });
    const item = musicCacheStore.getState().downloadQueue[0];
    expect(item.status).toBe('downloading');
    expect(item.completedTracks).toBe(1);
  });

  it('sets error on queue item', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'a' }));
    const queueId = musicCacheStore.getState().downloadQueue[0].queueId;
    musicCacheStore.getState().updateQueueItem(queueId, { status: 'error', error: 'Network failure' });
    expect(musicCacheStore.getState().downloadQueue[0].error).toBe('Network failure');
  });

  it('is a no-op for nonexistent queueId', () => {
    musicCacheStore.getState().enqueue(makeQueueItem({ itemId: 'a' }));
    musicCacheStore.getState().updateQueueItem('nonexistent', { status: 'downloading' });
    expect(musicCacheStore.getState().downloadQueue[0].status).toBe('queued');
  });
});

describe('removeCachedTrack edge cases', () => {
  it('is a no-op for nonexistent item', () => {
    musicCacheStore.getState().removeCachedTrack('nonexistent', 0);
    expect(musicCacheStore.getState().cachedItems['nonexistent']).toBeUndefined();
  });
});

describe('setMaxConcurrentDownloads', () => {
  it('updates the setting', () => {
    musicCacheStore.getState().setMaxConcurrentDownloads(5);
    expect(musicCacheStore.getState().maxConcurrentDownloads).toBe(5);
    musicCacheStore.getState().setMaxConcurrentDownloads(1);
    expect(musicCacheStore.getState().maxConcurrentDownloads).toBe(1);
  });
});

describe('recalculate', () => {
  it('replaces totals with provided stats', () => {
    musicCacheStore.setState({ totalBytes: 999, totalFiles: 99 });
    musicCacheStore.getState().recalculate({ totalBytes: 500, itemCount: 5, totalFiles: 10 });
    expect(musicCacheStore.getState().totalBytes).toBe(500);
    expect(musicCacheStore.getState().totalFiles).toBe(10);
  });
});
