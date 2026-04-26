/**
 * Shared trailing-metadata layout used by every list-row component.
 *
 * Each row in a list shares the same set of fixed-width slots so that
 * indicators (rating, downloaded, heart, duration) sit in a consistent
 * column position regardless of which neighbours are present on a given
 * row. Without this, variable-width content (e.g. `formatCompactDuration`
 * returning "10m" or "1h15m") drags the icons to its left around as the
 * user scrolls.
 *
 * Two layout shapes are supported:
 *
 *   1. **Sub-line meta** (AlbumRow, PlaylistRow, SongRow, ArtistRow) —
 *      pass `leading` to fill the flex:1 slot at the start of the line
 *      (e.g. `<icon> {trackCount}`). The trailing slots are pushed to
 *      the right edge of the row.
 *
 *   2. **Row-level trailing block** (TrackRow, QueueItemRow) — omit
 *      `leading`. The component renders only the trailing slots and
 *      sizes to its own children; the caller is responsible for placing
 *      it next to a flex:1 sibling that holds title/artist text.
 *
 * Slots are reserved per row TYPE (the `slots` prop): if a row type
 * doesn't show downloaded/rating/etc., omit that slot key and no width
 * is reserved. If a row of that type happens not to have a value for
 * the slot, the slot still occupies its width — that's the alignment
 * guarantee. Rule of thumb: slot widths are sized against the worst
 * case for that row type within a single list.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DownloadedIcon } from './DownloadedIcon';
import { CompactRatingBadge } from './StarRating';
import { useTheme } from '../hooks/useTheme';

/**
 * Compact rating glyph: filled star icon (12) + 3px gap + single digit
 * (~7px tabular-nums) + ~6px breathing for font variance. Matches the
 * `★ 4` review-site convention used by IMDB / Goodreads / Plexamp /
 * foobar2000 in compact list contexts. Detail views (set-rating sheet,
 * album-details modal, etc.) keep the full 5-star strip via
 * `StarRatingDisplay`.
 */
export const RATING_SLOT_WIDTH = 28;
/** 14px icon (heart, downloaded badge) + 4px on each side. */
export const ICON_SLOT_WIDTH = 22;
/**
 * Clock icon (14) + gap (3) + just enough text room for the bounded
 * formats. Sized against:
 *   - `formatCompactDuration` worst case "23h 59m" (7 chars) at 12px tabular-nums,
 *   - `formatTrackDuration` typical max "59:59" / "99:59" (5 chars) at 14px,
 * with ~2-4px breathing room for font variance across iOS SF / Android
 * Roboto. The bounded format is what lets the slot stay this snug — see
 * `formatCompactDuration` doc.
 */
export const DURATION_SLOT_WIDTH = 64;

export type SlotKey = 'rating' | 'heart' | 'download' | 'duration';

export type DownloadIndicator = 'complete' | 'partial' | 'none';

export interface RowMetaLineProps {
  /**
   * Inner JSX for the flex:1 leading slot (e.g. icon + count text).
   * The wrapper handles `flex:1, minWidth:0, flexDirection:'row',
   * alignItems:'center'` so callers don't repeat the right-shrink boilerplate.
   * Omit when the row uses RowMetaLine as a row-level trailing block.
   */
  leading?: React.ReactNode;

  /**
   * Which fixed-width slots to reserve for this row TYPE. Reserved means
   * the slot's width is held even when the value is absent on a given row,
   * keeping cross-row alignment. A slot omitted here doesn't render at all.
   *
   * Canonical visual order is `rating | download | heart | duration`,
   * regardless of the order keys appear in this prop.
   */
  slots: ReadonlyArray<SlotKey>;

  /** 0 / undefined → empty slot. */
  rating?: number;
  /** Renders a heart icon when true. */
  starred?: boolean;
  /** Mutually-exclusive download state. */
  downloadStatus?: DownloadIndicator;
  /** Pre-formatted duration text (formatter chosen by the caller). */
  durationText?: string;
  /**
   * Override colour for the duration text — used by TrackRow / QueueItemRow
   * when the row represents the currently-playing track. Defaults to
   * `colors.textSecondary`.
   */
  durationColor?: string;
  /**
   * Override font size for the duration text. Defaults to 12 (matches the
   * sub-line meta in AlbumRow/PlaylistRow/SongRow). Pass 14 for the
   * row-level trailing block in TrackRow/QueueItemRow to match their
   * existing sizing.
   */
  durationFontSize?: number;
}

export function RowMetaLine(props: RowMetaLineProps) {
  const {
    leading,
    slots,
    rating = 0,
    starred = false,
    downloadStatus = 'none',
    durationText,
    durationColor,
    durationFontSize = 12,
  } = props;
  const { colors } = useTheme();
  const { t } = useTranslation();

  const showRating = slots.includes('rating');
  const showHeart = slots.includes('heart');
  const showDownload = slots.includes('download');
  const showDuration = slots.includes('duration');

  const downloadIcon =
    downloadStatus === 'complete' ? (
      <DownloadedIcon size={14} circleColor={colors.primary} arrowColor="#fff" />
    ) : downloadStatus === 'partial' ? (
      <DownloadedIcon size={14} circleColor={colors.orange} arrowColor="#fff" />
    ) : null;

  // TODO(rtl): `textAlign: 'right'` and the per-slot fixed widths don't
  // auto-flip under `I18nManager.isRTL`. Substreamer doesn't ship an RTL
  // locale today; revisit if/when we do.
  return (
    <View style={styles.row}>
      {leading !== undefined ? (
        <View style={styles.leading} testID="rowmetaline-leading">{leading}</View>
      ) : null}
      {showRating ? (
        <View style={styles.ratingSlot} testID="rowmetaline-slot-rating">
          {rating > 0 ? (
            <View
              accessible
              accessibilityLabel={t('a11y.rating', {
                rating,
                defaultValue: 'Rating {{rating}} of 5',
              })}
            >
              <CompactRatingBadge
                rating={rating}
                size={12}
                iconColor={colors.primary}
                textColor={colors.textSecondary}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {showDownload ? (
        <View style={styles.iconSlot} testID="rowmetaline-slot-download">
          {downloadIcon ? (
            <View
              accessible
              accessibilityLabel={t(
                downloadStatus === 'partial'
                  ? 'a11y.partiallyDownloaded'
                  : 'a11y.downloaded',
                {
                  defaultValue:
                    downloadStatus === 'partial'
                      ? 'Partially downloaded'
                      : 'Downloaded',
                },
              )}
            >
              {downloadIcon}
            </View>
          ) : null}
        </View>
      ) : null}
      {showHeart ? (
        <View style={styles.iconSlot} testID="rowmetaline-slot-heart">
          {starred ? (
            <Ionicons
              name="heart"
              size={14}
              color={colors.red}
              accessibilityLabel={t('a11y.favourite', { defaultValue: 'Favourite' })}
            />
          ) : null}
        </View>
      ) : null}
      {showDuration ? (
        <View style={styles.durationSlot} testID="rowmetaline-slot-duration">
          {durationText ? (
            <>
              {/* Clock pins to the slot's left edge so it lines up across
                  rows; the text below uses flex:1 + textAlign:'right' so
                  its right edge lines up across rows even as the value
                  width varies between "10m" and "1h15m". */}
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text
                style={[
                  styles.durationText,
                  { fontSize: durationFontSize, color: durationColor ?? colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {durationText}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingSlot: {
    width: RATING_SLOT_WIDTH,
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  iconSlot: {
    width: ICON_SLOT_WIDTH,
    marginLeft: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationSlot: {
    width: DURATION_SLOT_WIDTH,
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationText: {
    // `flex: 1` makes the text fill the remaining slot width after the
    // clock icon, and `textAlign: 'right'` pins the value to the slot's
    // right edge. Combined with `tabular-nums` this guarantees the
    // clock stays at the slot's left edge across rows AND the value's
    // right edge lines up across rows, regardless of content width.
    flex: 1,
    marginLeft: 3,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
