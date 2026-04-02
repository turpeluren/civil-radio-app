const mockFileWrite = jest.fn();
let mockFileExists = false;
let mockDirExists = false;
const mockDirDelete = jest.fn();
const mockFileDelete = jest.fn();

jest.mock('../../store/sqliteStorage', () => require('../../store/__mocks__/sqliteStorage'));

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = parts.map((p: any) => (typeof p === 'string' ? p : p.uri ?? '')).join('/');
    }
    get exists() { return mockFileExists; }
    write = mockFileWrite;
    delete = mockFileDelete;
    text = jest.fn().mockResolvedValue('');
  }
  class MockDirectory {
    uri: string;
    constructor(...parts: any[]) {
      this.uri = parts.map((p: any) => (typeof p === 'string' ? p : p.uri ?? '')).join('/');
    }
    get exists() { return mockDirExists; }
    create = jest.fn();
    delete = mockDirDelete;
    get parentDirectory() { return new MockDirectory('parent'); }
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      document: new MockDirectory('document'),
    },
  };
});

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { Platform } from 'react-native';
import { getPendingTasks, runMigrations } from '../migrationService';
import { completedScrobbleStore } from '../../store/completedScrobbleStore';
import { mbidOverrideStore } from '../../store/mbidOverrideStore';
import { sqliteStorage } from '../../store/sqliteStorage';

beforeEach(() => {
  mockFileWrite.mockClear();
  mockDirDelete.mockClear();
  mockFileDelete.mockClear();
  mockFileExists = false;
  mockDirExists = false;
  (Platform as any).OS = 'ios';
});

describe('getPendingTasks', () => {
  it('returns all tasks when completedVersion is 0', () => {
    const tasks = getPendingTasks(0);
    expect(tasks.length).toBeGreaterThanOrEqual(2);
    expect(tasks[0].id).toBe(1);
  });

  it('returns tasks after completedVersion', () => {
    const tasks = getPendingTasks(1);
    expect(tasks.every((t) => t.id > 1)).toBe(true);
    expect(tasks.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array when all tasks are completed', () => {
    const tasks = getPendingTasks(999);
    expect(tasks).toHaveLength(0);
  });

  it('returns tasks in order', () => {
    const tasks = getPendingTasks(0);
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i].id).toBeGreaterThan(tasks[i - 1].id);
    }
  });
});

describe('runMigrations', () => {
  it('runs pending tasks and returns new completedVersion', async () => {
    const newVersion = await runMigrations(0);
    expect(newVersion).toBeGreaterThanOrEqual(2);
  });

  it('calls onProgress for each task', async () => {
    const onProgress = jest.fn();
    await runMigrations(0, onProgress);
    expect(onProgress).toHaveBeenCalledTimes(getPendingTasks(0).length);
    expect(onProgress.mock.calls[0][0]).toHaveProperty('id', 1);
    expect(onProgress.mock.calls[0][0]).toHaveProperty('name');
  });

  it('writes a migration log file', async () => {
    await runMigrations(0);
    expect(mockFileWrite).toHaveBeenCalledTimes(1);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Migration run:');
    expect(logContent).toContain('Task 1');
    expect(logContent).toContain('Task 2');
  });

  it('returns same version when no tasks are pending', async () => {
    const newVersion = await runMigrations(999);
    expect(newVersion).toBe(999);
  });

  it('writes a log file even when no tasks are pending', async () => {
    await runMigrations(999);
    expect(mockFileWrite).toHaveBeenCalledTimes(1);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Migration run:');
    expect(logContent).not.toContain('Task 1');
  });

  it('logs include platform info', async () => {
    await runMigrations(0);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Platform: ios');
  });

  it('Task 1 includes android files dir in bases', async () => {
    (Platform as any).OS = 'android';
    await runMigrations(0);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Platform: android');
    // The android branch adds a 'files' subdirectory to the bases list
    expect(logContent).toContain('files');
  });

  it('Task 1 deletes existing legacy directories', async () => {
    mockDirExists = true;
    await runMigrations(0);
    expect(mockDirDelete).toHaveBeenCalled();
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Removed:');
  });

  it('Task 1 logs failure when dir.delete throws', async () => {
    mockDirExists = true;
    mockDirDelete.mockImplementation(() => { throw new Error('EPERM'); });
    await runMigrations(0);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Failed to remove:');
  });

  it('Task 2 deletes legacy database files when dbDir exists', async () => {
    mockDirExists = true;
    mockFileExists = true;
    await runMigrations(0);
    expect(mockFileDelete).toHaveBeenCalled();
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Checking directory:');
    expect(logContent).toContain('Removed:');
  });

  it('Task 2 logs failure when file.delete throws', async () => {
    mockDirExists = true;
    mockFileExists = true;
    mockFileDelete.mockImplementation(() => { throw new Error('EPERM'); });
    await runMigrations(0);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Failed to remove:');
  });

  it('Task 3 skips aggregate rebuild when no scrobbles', async () => {
    completedScrobbleStore.setState({ completedScrobbles: [] } as any);
    await runMigrations(2);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('No scrobbles');
    expect(logContent).toContain('skipping aggregate rebuild');
  });

  it('Task 3 rebuilds aggregates when scrobbles exist', async () => {
    const mockRebuild = jest.fn();
    completedScrobbleStore.setState({
      completedScrobbles: [
        { id: '1', song: { id: 's1', title: 'Song', artist: 'A', duration: 200 }, time: Date.now() },
      ],
      rebuildAggregates: mockRebuild,
    } as any);
    await runMigrations(2);
    expect(mockRebuild).toHaveBeenCalled();
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Rebuilt aggregates for 1 scrobbles');
  });

  it('Task 2 uses android databases path', async () => {
    (Platform as any).OS = 'android';
    mockDirExists = true;
    mockFileExists = false;
    await runMigrations(0);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Checking directory:');
    expect(logContent).toContain('Not found:');
  });

  it('Task 4 skips when no persisted shares data', async () => {
    sqliteStorage.removeItem('substreamer-shares');
    await runMigrations(3);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('No persisted shares data');
  });

  it('Task 4 skips when shares data is valid', async () => {
    sqliteStorage.setItem('substreamer-shares', JSON.stringify({ state: { shares: [] } }));
    await runMigrations(3);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Shares data is valid');
  });

  it('Task 4 fixes corrupted shares field', async () => {
    sqliteStorage.setItem('substreamer-shares', JSON.stringify({ state: { shares: null } }));
    await runMigrations(3);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Fixed corrupted shares field');
    const restored = JSON.parse(sqliteStorage.getItem('substreamer-shares') as string);
    expect(restored.state.shares).toEqual([]);
  });

  it('Task 4 removes unparseable JSON', async () => {
    sqliteStorage.setItem('substreamer-shares', '{bad json');
    await runMigrations(3);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Removed unparseable shares data');
    expect(sqliteStorage.getItem('substreamer-shares')).toBeNull();
  });

  it('Task 5 skips when no MBID overrides', async () => {
    mbidOverrideStore.setState({ overrides: {} });
    await runMigrations(4);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('No MBID overrides');
  });

  it('Task 5 skips when overrides already migrated', async () => {
    mbidOverrideStore.setState({
      overrides: {
        'artist:123': { type: 'artist', entityId: '123', entityName: 'Test', mbid: 'abc' },
      },
    } as any);
    await runMigrations(4);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('already in new format');
  });

  it('Task 5 migrates old-format overrides to new format', async () => {
    mbidOverrideStore.setState({
      overrides: {
        '123': { artistId: '123', artistName: 'Test Artist', mbid: 'abc-def' },
      },
    } as any);
    await runMigrations(4);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Migrated 1 MBID override(s)');
    const overrides = mbidOverrideStore.getState().overrides;
    expect(overrides['artist:123']).toEqual({
      type: 'artist',
      entityId: '123',
      entityName: 'Test Artist',
      mbid: 'abc-def',
    });
  });

  it('Task 6 skips when no persisted playback settings', async () => {
    sqliteStorage.removeItem('substreamer-playback-settings');
    await runMigrations(5);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('No persisted playback settings');
  });

  it('Task 6 sets estimateContentLength to false on iOS', async () => {
    (Platform as any).OS = 'ios';
    sqliteStorage.setItem(
      'substreamer-playback-settings',
      JSON.stringify({ state: { estimateContentLength: true } }),
    );
    await runMigrations(5);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Set estimateContentLength to false (ios)');
    const restored = JSON.parse(sqliteStorage.getItem('substreamer-playback-settings') as string);
    expect(restored.state.estimateContentLength).toBe(false);
  });

  it('Task 6 sets estimateContentLength to true on Android', async () => {
    (Platform as any).OS = 'android';
    sqliteStorage.setItem(
      'substreamer-playback-settings',
      JSON.stringify({ state: { estimateContentLength: false } }),
    );
    await runMigrations(5);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Set estimateContentLength to true (android)');
    const restored = JSON.parse(sqliteStorage.getItem('substreamer-playback-settings') as string);
    expect(restored.state.estimateContentLength).toBe(true);
  });

  it('Task 6 skips when persisted data has no state', async () => {
    sqliteStorage.setItem('substreamer-playback-settings', JSON.stringify({}));
    await runMigrations(5);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('No state in persisted data');
  });

  it('Task 6 handles corrupted JSON gracefully', async () => {
    sqliteStorage.setItem('substreamer-playback-settings', '{bad json');
    await runMigrations(5);
    const logContent = mockFileWrite.mock.calls[0][0] as string;
    expect(logContent).toContain('Failed to parse playback settings');
  });
});
