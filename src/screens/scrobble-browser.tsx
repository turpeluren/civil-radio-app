import { FlashList } from '@shopify/flash-list';
import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState as EmptyStateComponent } from '../components/EmptyState';
import { GradientBackground } from '../components/GradientBackground';
import { SegmentControl } from '../components/SegmentControl';
import { useTheme } from '../hooks/useTheme';
import { completedScrobbleStore, type CompletedScrobble } from '../store/completedScrobbleStore';
import { pendingScrobbleStore, type PendingScrobble } from '../store/pendingScrobbleStore';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Scrobble = PendingScrobble | CompletedScrobble;

type ScrobbleSegment = 'completed' | 'pending';

const SEGMENTS = [
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
] as const;

const ROW_HEIGHT = 56;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/* ------------------------------------------------------------------ */
/*  ScrobbleRow                                                        */
/* ------------------------------------------------------------------ */

const ScrobbleRow = memo(function ScrobbleRow({
  scrobble,
  colors,
}: {
  scrobble: Scrobble;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.trackTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {scrobble.song.title}
        </Text>
        {scrobble.song.artist ? (
          <Text style={[styles.artistName, { color: colors.textSecondary }]} numberOfLines={1}>
            {scrobble.song.artist}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>
        {timeAgo(scrobble.time)}
      </Text>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

function ScrobbleEmptyState({ segment }: { segment: ScrobbleSegment }) {
  const icon = segment === 'completed' ? 'checkmark-done-outline' : 'time-outline';
  const message =
    segment === 'completed' ? 'No completed scrobbles yet' : 'No pending scrobbles';
  const subtitle =
    segment === 'completed'
      ? 'Scrobbles will appear here after tracks finish playing'
      : 'Pending scrobbles are sent to your server automatically';

  return <EmptyStateComponent icon={icon} title={message} subtitle={subtitle} />;
}

/* ------------------------------------------------------------------ */
/*  ScrobbleBrowserScreen                                              */
/* ------------------------------------------------------------------ */

export function ScrobbleBrowserScreen() {
  const { colors } = useTheme();
  const [activeSegment, setActiveSegment] = useState<ScrobbleSegment>('completed');

  const pendingScrobbles = pendingScrobbleStore((s) => s.pendingScrobbles);
  const completedScrobbles = completedScrobbleStore((s) => s.completedScrobbles);


  const completedReversed = useMemo(
    () => [...completedScrobbles].reverse(),
    [completedScrobbles],
  );

  const pendingReversed = useMemo(
    () => [...pendingScrobbles].reverse(),
    [pendingScrobbles],
  );

  const keyExtractor = useCallback((item: Scrobble, index: number) => `${item.id}-${index}`, []);

  const renderItem = useCallback(
    ({ item }: { item: Scrobble }) => <ScrobbleRow scrobble={item} colors={colors} />,
    [colors],
  );

  const completedEmpty = useCallback(
    () => <ScrobbleEmptyState segment="completed" />,
    [],
  );

  const pendingEmpty = useCallback(
    () => <ScrobbleEmptyState segment="pending" />,
    [],
  );

  return (
    <GradientBackground style={styles.container}>
      <SegmentControl segments={SEGMENTS} selected={activeSegment} onSelect={setActiveSegment} />
      <View style={styles.content}>
        {activeSegment === 'completed' && (
          <FlashList
            data={completedReversed}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListEmptyComponent={completedEmpty}
            contentContainerStyle={completedReversed.length === 0 ? styles.emptyListContent : undefined}
          />
        )}
        {activeSegment === 'pending' && (
          <FlashList
            data={pendingReversed}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListEmptyComponent={pendingEmpty}
            contentContainerStyle={pendingReversed.length === 0 ? styles.emptyListContent : undefined}
          />
        )}
      </View>
    </GradientBackground>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: ROW_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  artistName: {
    fontSize: 13,
    marginTop: 2,
  },
  timeLabel: {
    fontSize: 12,
    flexShrink: 0,
  },
});
