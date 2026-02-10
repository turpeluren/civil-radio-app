import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AlbumListView } from '../components/AlbumListView';
import { useTheme } from '../hooks/useTheme';
import { albumLibraryStore } from '../store/albumLibraryStore';

/* ------------------------------------------------------------------ */
/*  Segment types                                                     */
/* ------------------------------------------------------------------ */

type Segment = 'albums' | 'artists' | 'playlists';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' },
];

/* ------------------------------------------------------------------ */
/*  SegmentControl                                                    */
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
/*  Albums tab content                                                */
/* ------------------------------------------------------------------ */

function AlbumsTab() {
  const albums = albumLibraryStore((s) => s.albums);
  const loading = albumLibraryStore((s) => s.loading);
  const error = albumLibraryStore((s) => s.error);
  const fetchAllAlbums = albumLibraryStore((s) => s.fetchAllAlbums);

  // Auto-fetch when mounted if the store has no data
  useEffect(() => {
    if (albums.length === 0 && !loading) {
      fetchAllAlbums();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(() => {
    fetchAllAlbums();
  }, [fetchAllAlbums]);

  return (
    <AlbumListView
      albums={albums}
      loading={loading}
      error={error}
      onRefresh={handleRefresh}
      refreshing={loading && albums.length > 0}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Placeholder tabs (artists / playlists – to be implemented)        */
/* ------------------------------------------------------------------ */

function PlaceholderTab({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.placeholder, { backgroundColor: colors.background }]}>
      <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
        {label} coming soon
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  LibraryScreen                                                     */
/* ------------------------------------------------------------------ */

export function LibraryScreen() {
  const { colors } = useTheme();
  const [activeSegment, setActiveSegment] = useState<Segment>('albums');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SegmentControl selected={activeSegment} onSelect={setActiveSegment} />
      <View style={styles.content}>
        {activeSegment === 'albums' && <AlbumsTab />}
        {activeSegment === 'artists' && <PlaceholderTab label="Artists" />}
        {activeSegment === 'playlists' && <PlaceholderTab label="Playlists" />}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                            */
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
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
  },
});
