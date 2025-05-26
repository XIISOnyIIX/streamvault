
import React from 'react';

export enum Page {
  Home = 'home',
  LiveTV = 'live-tv',
  Movies = 'movies',
  Series = 'series',
  WatchedHistory = 'watched-history', // Renamed from WatchHistory
  Playlists = 'playlists',
  Settings = 'settings',
  SeriesDetail = 'series-detail', 
  VideoPlayer = 'video-player', 
  ContinueWatchingAll = 'continue-watching-all',
}

export interface Profile {
  id: number;
  name: string;
  avatar: string; // Can be a character, emoji, or DEFAULT_USER_ICON_ID
  isActive: boolean;
  avatarBgColor?: string; 
}

export interface EpisodeInfo {
  id: string;
  title: string;
  season: number;
  episode: number;
  stream_id?: number; 
  container_extension?: string;
  info?: any; 
  url?: string; 
  poster?: string; 
}

export interface SeasonInfo {
  season_number: number;
  name?: string; 
  episodes: EpisodeInfo[];
  air_date?: string;
  overview?: string;
  cover?: string; 
}


export interface ContentItem {
  id: string; 
  type: 'channel' | 'movie' | 'series' | 'episode'; 
  name: string;
  url: string; 
  poster?: string;
  group?: string; 
  rating?: string; // Original content rating (e.g., IMDb)
  year?: string; 
  episode?: string; // Original episode identifier like S1E1 from series card
  totalEpisodes?: number; 
  progress?: number; // Calculated display progress for continue watching
  categoryName?: string;
  playlistName?: string; // Added to link item to its source playlist

  // Series specific
  seriesId?: string; 
  seasons?: SeasonInfo[]; 
  totalSeasons?: number; 

  // Episode specific (can be part of a ContentItem if we treat episodes as such)
  seasonNumber?: number;
  episodeNumber?: number;
  duration?: number; // Duration of this specific episode/movie

  // Additional fields for localStorage reconstruction and display (Continue Watching & Watch History)
  originalType?: 'movie' | 'episode' | 'channel'; 
  seriesName?: string; // If it's an episode, the name of the series for display
  episodeTitle?: string; // If it's an episode, its specific title
  lastPlayed?: number; // Timestamp for sorting CW
  watchedOn?: number; // Timestamp for sorting Watch History
  userRating?: number; // User's 1-10 star rating
  displayStatus?: 'watched' | 'watching'; // Added for card indicators
}

export interface Playlist {
  type: 'm3u' | 'xtream';
  name: string;
  url?: string; 
  serverUrl?: string; 
  username?: string; 
  password?: string; 
  content: ContentItem[];
}

export interface MessageBoxState {
  isOpen: boolean;
  title: string;
  message: string;
}

export interface LoadingState {
  isLoading: boolean;
  message: string;
}

export interface CurrentlyPlayingState {
  url: string | null;
  title: string | null;
  poster?: string | null; 
  contentId?: string | null; 
  type?: ContentItem['type']; 
  originalType?: ContentItem['originalType']; // Added for accurate history logging
  startTime?: number; 
  // For auto-play next episode context & history logging
  seriesId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  seriesName?: string;
  episodeTitle?: string; // Added for history
  group?: string; // Added for history
  year?: string; // Added for history
  playlistName?: string; // Added to track source playlist during playback
}

export interface NavigationItem {
  id: Page;
  label: string;
  icon: React.FC<{ className?: string }>;
}

export interface ResumePlaybackModalState {
  isOpen: boolean;
  item: ContentItem | null;
  savedTime: number;
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  itemToAction?: ContentItem | null; 
  itemIdToAction?: string | null; 
  onConfirm: () => void;
}

export interface RateContentModalState {
  isOpen: boolean;
  item: ContentItem | null;
}

// New state for in-player next episode card
export interface NextEpisodeDataForPlayerState {
  nextEpisode: ContentItem;
  seriesName?: string;
  seriesPoster?: string;
}

// --- App Settings ---
export interface AppSettings {
  defaultLaunchSection: Page.Home | Page.LiveTV | Page.Movies | Page.Series;
  autoRefreshChannels: 'daily' | 'everyWeek'; // Updated from 'everyLaunch'
  enableUpdateNotifications: boolean;
}

export interface EditProfileModalState {
  isOpen: boolean;
  profile: Profile | null; // The profile being edited
}

export interface FeedbackModalState { 
  isOpen: boolean;
}

export interface UpdateReadyModalState { // New for auto-update
    isOpen: boolean;
}
// --- End App Settings ---

// --- Page View Props common to multiple page components ---
export interface PageViewProps {
  activeProfile?: Profile;
  playlists: Playlist[];
  watchHistory?: ContentItem[];
  filteredContent: ContentItem[];
  onPlayContent: (item: ContentItem) => void;
  onNavigate: (page: Page, context?: any) => void;
  onAddPlaylist: () => void;
  onRemovePlaylist: (playlistName: string) => void;
  onRefreshPlaylist: (playlistName: string) => void;
  lastPlayedTimestamp: number;
  onRemoveFromContinueWatching: (item: ContentItem) => void;
  onRequestClearAllContinueWatching?: () => void;
  onRequestClearAllWatchHistory?: () => void;
  onRemoveFromHistory?: (item: ContentItem) => void;
  onRateContent?: (item: ContentItem) => void;
  displayLimit: number;
  onSetDisplayLimit: (limit: number) => void;
  onViewSeriesDetail?: (seriesData: { seriesId: string, seriesName: string, poster?: string }) => void;
  
  // Settings Page specific props
  appSettings?: AppSettings;
  onAppSettingsChange?: (settingName: keyof AppSettings, value: any) => void;
  onOpenEditProfileModal?: () => void;
  onClearCache?: () => void;
  cacheUsageMB?: string;
  onResetProfile?: () => void;
  showMessageBox?: (title: string, message: string) => void;
  onOpenFeedbackModal?: () => void; 

  // For first launch experience
  isFirstPlaylistAdded?: boolean; 
}
// --- End Page View Props ---


// --- Electron API exposed via preload.js ---
export interface ElectronAPI {
  fetchM3U: (url: string) => Promise<string>;
  fetchXtreamCodes: (baseUrl: string, username: string, password: string, action: string, params?: Record<string, any>) => Promise<any>; 
  savePlaylists: (playlists: Playlist[]) => Promise<void>;
  loadPlaylists: () => Promise<Playlist[] | null>;
  saveWatchHistory: (history: ContentItem[]) => Promise<void>; 
  loadWatchHistory: () => Promise<ContentItem[] | null>;
  getCacheSize: () => Promise<number>; // Returns size in bytes
  clearAppCache: () => Promise<void>;
  saveProfiles: (profiles: Profile[]) => Promise<void>; 
  loadProfiles: () => Promise<Profile[] | null>;
  
  // For Auto Update Notifications
  onUpdateReady: (callback: () => void) => (() => void) | undefined; // Listener, returns cleanup function or undefined
  quitAndInstall: () => void; // Triggers app quit and install
  checkForUpdates: () => void; // Added
}

// Extend the Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
// --- End of Electron API ---
