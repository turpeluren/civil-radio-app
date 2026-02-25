import { useMemo } from 'react';

import { type Child } from '../services/subsonicService';

export type TimePeriod = '7d' | '30d' | '90d' | 'all';

export interface ScrobbleRecord {
  id: string;
  song: Child;
  time: number;
}

export interface DailyActivity {
  date: string;
  count: number;
}

export interface TopSong {
  song: Child;
  count: number;
}

export interface TopArtist {
  artist: string;
  count: number;
}

export interface TopAlbum {
  album: string;
  artist: string;
  coverArt?: string;
  count: number;
}

export interface GenreSlice {
  genre: string;
  count: number;
  percentage: number;
}

export interface PlaybackAnalytics {
  totalPlays: number;
  totalListeningSeconds: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  longestStreak: number;
  currentStreak: number;
  dailyActivity: DailyActivity[];
  hourlyDistribution: number[];
  topSongs: TopSong[];
  topArtists: TopArtist[];
  topAlbums: TopAlbum[];
  genreBreakdown: GenreSlice[];
  heatmapData: DailyActivity[];
  peakHour: number;
  averagePlaysPerDay: number;
}

const PERIOD_DAYS: Record<TimePeriod, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

const HEATMAP_WEEKS = 16;

function dateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function computeStreaks(scrobbles: Pick<ScrobbleRecord, 'time'>[]): {
  longest: number;
  current: number;
} {
  if (scrobbles.length === 0) return { longest: 0, current: 0 };

  const daySet = new Set<number>();
  for (const s of scrobbles) {
    daySet.add(startOfDay(s.time));
  }

  const sortedDays = Array.from(daySet).sort((a, b) => a - b);

  const ONE_DAY = 86_400_000;
  let longest = 1;
  let current = 1;
  let streak = 1;

  for (let i = 1; i < sortedDays.length; i++) {
    const diff = sortedDays[i] - sortedDays[i - 1];
    if (diff === ONE_DAY) {
      streak++;
    } else {
      streak = 1;
    }
    if (streak > longest) longest = streak;
  }

  // Current streak: count backwards from today
  const todayStart = startOfDay(Date.now());
  current = 0;
  let checkDay = todayStart;
  while (daySet.has(checkDay)) {
    current++;
    checkDay -= ONE_DAY;
  }
  // If no scrobble today, check if yesterday continues a streak
  if (current === 0) {
    checkDay = todayStart - ONE_DAY;
    while (daySet.has(checkDay)) {
      current++;
      checkDay -= ONE_DAY;
    }
  }

  return { longest, current };
}

export function usePlaybackAnalytics(
  scrobbles: ScrobbleRecord[],
  period: TimePeriod,
  pendingScrobbles?: Pick<ScrobbleRecord, 'time'>[]
): PlaybackAnalytics {
  return useMemo(() => {
    const periodDays = PERIOD_DAYS[period];
    const cutoff = periodDays
      ? Date.now() - periodDays * 86_400_000
      : 0;

    const filtered = periodDays
      ? scrobbles.filter((s) => s.time >= cutoff)
      : scrobbles;

    const totalPlays = filtered.length;

    let totalListeningSeconds = 0;
    const artistCounts = new Map<string, number>();
    const albumCounts = new Map<string, { artist: string; coverArt?: string; count: number }>();
    const songCounts = new Map<string, { song: Child; count: number }>();
    const genreCounts = new Map<string, number>();
    const hourBuckets = new Array<number>(24).fill(0);
    const dayCounts = new Map<string, number>();

    for (const s of filtered) {
      if (s.song.duration) {
        totalListeningSeconds += s.song.duration;
      }

      const artist = s.song.artist ?? 'Unknown';
      artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);

      const albumKey = `${s.song.album ?? 'Unknown'}::${artist}`;
      const existing = albumCounts.get(albumKey);
      if (existing) {
        existing.count++;
      } else {
        albumCounts.set(albumKey, {
          artist,
          coverArt: s.song.coverArt ?? undefined,
          count: 1,
        });
      }

      const songEntry = songCounts.get(s.song.id);
      if (songEntry) {
        songEntry.count++;
      } else {
        songCounts.set(s.song.id, { song: s.song, count: 1 });
      }

      const genre = s.song.genre ?? (s.song.genres?.[0] ?? null);
      if (genre) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }

      const hour = new Date(s.time).getHours();
      hourBuckets[hour]++;

      const dk = dateKey(s.time);
      dayCounts.set(dk, (dayCounts.get(dk) ?? 0) + 1);
    }

    // Top songs
    const topSongs = Array.from(songCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top artists
    const topArtists = Array.from(artistCounts.entries())
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top albums
    const topAlbums = Array.from(albumCounts.entries())
      .map(([key, val]) => ({
        album: key.split('::')[0],
        artist: val.artist,
        coverArt: val.coverArt,
        count: val.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Genre breakdown (top 6 + Other)
    const sortedGenres = Array.from(genreCounts.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);

    const totalWithGenre = sortedGenres.reduce((sum, g) => sum + g.count, 0);
    let genreBreakdown: GenreSlice[];
    if (sortedGenres.length <= 6) {
      genreBreakdown = sortedGenres.map((g) => ({
        ...g,
        percentage: totalWithGenre > 0 ? (g.count / totalWithGenre) * 100 : 0,
      }));
    } else {
      const top = sortedGenres.slice(0, 5);
      const otherCount = sortedGenres.slice(5).reduce((sum, g) => sum + g.count, 0);
      genreBreakdown = [
        ...top.map((g) => ({
          ...g,
          percentage: totalWithGenre > 0 ? (g.count / totalWithGenre) * 100 : 0,
        })),
        {
          genre: 'Other',
          count: otherCount,
          percentage: totalWithGenre > 0 ? (otherCount / totalWithGenre) * 100 : 0,
        },
      ];
    }

    // Daily activity for the selected period
    const activityDays = periodDays ?? 90;
    const dailyActivity: DailyActivity[] = [];
    const now = Date.now();
    for (let i = activityDays - 1; i >= 0; i--) {
      const dk = dateKey(now - i * 86_400_000);
      dailyActivity.push({ date: dk, count: dayCounts.get(dk) ?? 0 });
    }

    // Heatmap data (always last 16 weeks regardless of period filter)
    const heatmapDays = HEATMAP_WEEKS * 7;
    const allDayCounts = new Map<string, number>();
    for (const s of scrobbles) {
      const dk = dateKey(s.time);
      allDayCounts.set(dk, (allDayCounts.get(dk) ?? 0) + 1);
    }
    const heatmapData: DailyActivity[] = [];
    // Start from the most recent Sunday to align the grid
    const today = new Date();
    const todayDay = today.getDay();
    const gridEnd = new Date(today);
    gridEnd.setDate(gridEnd.getDate() + (6 - todayDay));
    gridEnd.setHours(0, 0, 0, 0);
    const gridStart = new Date(gridEnd);
    gridStart.setDate(gridStart.getDate() - heatmapDays + 1);

    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      const dk = dateKey(d.getTime());
      heatmapData.push({ date: dk, count: allDayCounts.get(dk) ?? 0 });
    }

    // Peak hour
    let peakHour = 0;
    let peakCount = 0;
    for (let h = 0; h < 24; h++) {
      if (hourBuckets[h] > peakCount) {
        peakCount = hourBuckets[h];
        peakHour = h;
      }
    }

    // Streaks – include pending scrobbles so offline plays count
    const pendingFiltered = pendingScrobbles
      ? (periodDays ? pendingScrobbles.filter((s) => s.time >= cutoff) : pendingScrobbles)
      : [];
    const { longest, current } = computeStreaks([...filtered, ...pendingFiltered]);

    // Average plays per day
    const uniqueDays = dayCounts.size;
    const averagePlaysPerDay =
      uniqueDays > 0 ? Math.round((totalPlays / uniqueDays) * 10) / 10 : 0;

    return {
      totalPlays,
      totalListeningSeconds,
      uniqueArtists: artistCounts.size,
      uniqueAlbums: albumCounts.size,
      longestStreak: longest,
      currentStreak: current,
      dailyActivity,
      hourlyDistribution: hourBuckets,
      topSongs,
      topArtists,
      topAlbums,
      genreBreakdown,
      heatmapData,
      peakHour,
      averagePlaysPerDay,
    };
  }, [scrobbles, period, pendingScrobbles]);
}
