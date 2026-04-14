/**
 * Reusable section title component for detail screens.
 *
 * Renders an uppercase, small-caps style heading used to label
 * sections like "About", "Top Songs", "Similar Artists", "Albums", etc.
 */

import { StyleSheet, Text } from 'react-native';

export function SectionTitle({ title, color }: { title: string; color: string }) {
  return <Text style={[styles.sectionTitle, { color }]}>{title}</Text>;
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
});
