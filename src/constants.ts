
import { Page, NavigationItem, ContentItem, Profile, AppSettings } from './types';
import { HomeIcon, LiveTVIcon, MoviesIcon, SeriesIcon, WatchHistoryIcon, PlaylistsIcon, SettingsIcon } from './components/common/Icons';

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { id: Page.Home, label: 'Home', icon: HomeIcon },
  { id: Page.LiveTV, label: 'Live TV', icon: LiveTVIcon },
  { id: Page.Movies, label: 'Movies', icon: MoviesIcon },
  { id: Page.Series, label: 'Series', icon: SeriesIcon },
  { id: Page.WatchedHistory, label: 'Watched History', icon: WatchHistoryIcon },
  { id: Page.Playlists, label: 'Playlists', icon: PlaylistsIcon },
  { id: Page.Settings, label: 'Settings', icon: SettingsIcon },
];

export const FALLBACK_CONTENT: { channels: ContentItem[], movies: ContentItem[], series: ContentItem[] } = {
  channels: [
    { id: 'fb-ch1', type: 'channel', name: 'Fallback News', url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_10mb.mp4', poster: 'https://picsum.photos/seed/fb-ch1/200/112', group: 'News' },
    { id: 'fb-ch2', type: 'channel', name: 'Fallback Sports', url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_10mb.mp4', poster: 'https://picsum.photos/seed/fb-ch2/200/112', group: 'Sports' }
  ],
  movies: [
    { id: 'fb-mov1', type: 'movie', name: 'Fallback Action Film', url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_10mb.mp4', poster: 'https://picsum.photos/seed/fb-mov1/200/112', rating: '7.8', year: '2020' }
  ],
  series: [
    { id: 'fb-ser1', type: 'series', name: 'Fallback Sci-Fi Series', url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_10mb.mp4', poster: 'https://picsum.photos/seed/fb-ser1/200/112', episode: 'S1E1', totalEpisodes: 5 }
  ]
};

export const DEFAULT_USER_ICON_ID = 'system-default-user-icon';

export const DEFAULT_PROFILES: Profile[] = [
  { id: 1, name: 'Main Profile', avatar: DEFAULT_USER_ICON_ID, isActive: true, avatarBgColor: undefined }
];

export const LAUNCH_SECTIONS: Array<{ value: Page.Home | Page.LiveTV | Page.Movies | Page.Series; label: string }> = [
  { value: Page.Home, label: 'Home' },
  { value: Page.LiveTV, label: 'Live TV' },
  { value: Page.Movies, label: 'Movies' },
  { value: Page.Series, label: 'Series' },
];

export const AUTO_REFRESH_OPTIONS: Array<{ value: 'daily' | 'everyWeek'; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'everyWeek', label: 'Every Week' },
];

export const PREFERRED_AVATARS: string[] = [
  DEFAULT_USER_ICON_ID, 
  '🥷', 
  '🧙', 
  '🗡️', 
  '🤖', 
  '🏴‍☠️', 
  '👽', 
  '🐱', 
  '🐶', 
  '🐰', 
  '🐼',
  '✨', 
  '🚀', 
  '🎮', 
  '🎬', 
  '🎵'
];

export const PREFERRED_AVATAR_BG_COLORS: string[] = [
  '#FF6B6B', // Light Red
  '#4ECDC4', // Turquoise
  '#45B7D1', // Sky Blue
  '#FED766', // Light Yellow
  '#F9A826', // Orange
  '#FF8C42', // Tangerine
  '#8A6FDF', // Light Purple
  '#D65DB1', // Pink
  '#2ECC71', // Emerald Green
  '#3498DB', // Peter River Blue
  '#9B59B6', // Amethyst Purple
  '#34495E', // Wet Asphalt
  '#E74C3C', // Alizarin Crimson
  '#F1C40F', // Sunflower Yellow
  '#1ABC9C', // Turquoise Green
  '#7F8C8D'  // Asbestos (Gray)
];


export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultLaunchSection: Page.Home,
  autoRefreshChannels: 'everyWeek', 
  enableUpdateNotifications: true,
};

export const APP_SETTINGS_STORAGE_KEY = 'streamvault_app_settings_v1';
export const LOCAL_STORAGE_HAS_LAUNCHED_KEY = 'streamvault_has_launched_before_v1'; // New
