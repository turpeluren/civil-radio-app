import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { useCallback } from 'react';
import { Keyboard, View } from 'react-native';

import WaveformLogo from '../../components/WaveformLogo';
import { ConnectivityBanner } from '../../components/ConnectivityBanner';
import { DownloadBanner } from '../../components/DownloadBanner';
import { GradientBackground } from '../../components/GradientBackground';
import { StorageFullBanner } from '../../components/StorageFullBanner';
import { MiniPlayer } from '../../components/MiniPlayer';
import { SearchableHeader } from '../../components/SearchableHeader';
import { SearchResultsOverlay } from '../../components/SearchResultsOverlay';
import { useTheme } from '../../hooks/useTheme';

export default function TabLayout() {
  const { colors } = useTheme();

  const renderTabBar = useCallback(
    (props: React.ComponentProps<typeof BottomTabBar>) => (
      <>
        <DownloadBanner />
        <MiniPlayer />
        <BottomTabBar {...props} />
      </>
    ),
    [],
  );

  return (
    <GradientBackground>
      <Tabs
        tabBar={renderTabBar}
        screenListeners={{
          tabPress: () => Keyboard.dismiss(),
        }}
        screenOptions={{
          header: (props) => (
            <>
              <SearchableHeader {...props} />
              <ConnectivityBanner />
              <StorageFullBanner />
            </>
          ),
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: 'transparent',
          },
          headerTransparent: true,
          sceneStyle: { backgroundColor: 'transparent' },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <WaveformLogo size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="musical-notes" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: 'Favorites',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="heart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <SearchResultsOverlay />
    </GradientBackground>
  );
}
