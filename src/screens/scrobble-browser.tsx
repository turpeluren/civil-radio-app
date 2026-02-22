import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../hooks/useTheme';
import { completedScrobbleStore, type CompletedScrobble } from '../store/completedScrobbleStore';
import { pendingScrobbleStore, type PendingScrobble } from '../store/pendingScrobbleStore';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Scrobble = PendingScrobble | CompletedScrobble;

type Segment = 'completed' | 'pending';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
];

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
/*  SegmentControl                                                     */
/* ------------------------------------------------------------------ */

function SegmentControl({
  selected,
  onSelect,
}: {
  selected: Segment;
  onSelect: (segment: Segment) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.segmentContainer, { backgroundColor: colors.inputBg }]}>
      {SEGMENTS.map(({ key, label }) => {
        const isActive = selected === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={[
              styles.segmentButton,
              isActive && [styles.segmentButtonActive, { backgroundColor: colors.card }],
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: isActive ? colors.textPrimary : colors.textSecondary },
                isActive && styles.segmentLabelActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
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

function EmptyState({
  segment,
  colors,
}: {
  segment: Segment;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const icon = segment === 'completed' ? 'checkmark-done-outline' : 'time-outline';
  const message =
    segment === 'completed' ? 'No completed scrobbles yet' : 'No pending scrobbles';

  return (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={56} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  ScrobbleBrowserScreen                                              */
/* ------------------------------------------------------------------ */

export function ScrobbleBrowserScreen() {
  const { colors } = useTheme();
  const [activeSegment, setActiveSegment] = useState<Segment>('completed');

  const pendingScrobbles = pendingScrobbleStore((s) => s.pendingScrobbles);
  const completedScrobbles = completedScrobbleStore((s) => s.completedScrobbles);


  const completedReversed = useMemo(
    () => [...completedScrobbles].reverse(),
    [completedScrobbles],
  );

  const keyExtractor = useCallback((item: Scrobble, index: number) => `${item.id}-${index}`, []);

  const renderItem = useCallback(
    ({ item }: { item: Scrobble }) => <ScrobbleRow scrobble={item} colors={colors} />,
    [colors],
  );

  const completedEmpty = useCallback(
    () => <EmptyState segment="completed" colors={colors} />,
    [colors],
  );

  const pendingEmpty = useCallback(
    () => <EmptyState segment="pending" colors={colors} />,
    [colors],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SegmentControl selected={activeSegment} onSelect={setActiveSegment} />
      <View style={styles.content}>
        {activeSegment === 'completed' && (
          <FlashList
            data={completedReversed}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            estimatedItemSize={ROW_HEIGHT}
            ListEmptyComponent={completedEmpty}
          />
        )}
        {activeSegment === 'pending' && (
          <FlashList
            data={pendingScrobbles}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            estimatedItemSize={ROW_HEIGHT}
            ListEmptyComponent={pendingEmpty}
          />
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  segmentLabelActive: {
    fontWeight: '600',
  },
  content: {
    flex: 1,
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
});
