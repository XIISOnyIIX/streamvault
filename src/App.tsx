
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion'; // Added for animations
import { Page, Profile, Playlist, ContentItem, MessageBoxState, LoadingState, CurrentlyPlayingState, SeasonInfo, EpisodeInfo, ResumePlaybackModalState, ConfirmModalState, NextEpisodeDataForPlayerState, RateContentModalState, ElectronAPI, AppSettings, EditProfileModalState, FeedbackModalState, PageViewProps as GlobalPageViewProps, UpdateReadyModalState } from './types';
import { Sidebar, Header } from './components/Layout';
import { 
    VideoPlayer, 
    HomePageView, LiveTVPageView, MoviesPageView, SeriesPageView, PlaylistsPageView, SettingsPageView,
    SeriesDetailPageView, INITIAL_ITEMS_TO_SHOW_GENERIC_CONTENT, ContinueWatchingAllPageView, WatchHistoryPageView,
    getConsolidatedContinueWatchingItems 
} from './components/Content';
import { PlaylistModal, MessageBox, LoadingOverlay, ResumePlaybackModal, ConfirmDeleteModal, RateContentModal, EditProfileModal, FeedbackModal, UpdateReadyModal } from './components/Overlays';
import SplashScreen from './components/SplashScreen'; // New import
import { handleAddPlaylist, fetchXtreamSeriesEpisodes, SERIES_PLACEHOLDER_URL_PREFIX } from './services/iptvService';
import { DEFAULT_PROFILES, DEFAULT_APP_SETTINGS, APP_SETTINGS_STORAGE_KEY, DEFAULT_USER_ICON_ID, LOCAL_STORAGE_HAS_LAUNCHED_KEY } from './constants'; 
import { WatchHistoryIcon, StarIcon, UserIcon, SpinnerIcon } from './components/common/Icons';
import { supabase } from './supabaseClient';

const WATCH_HISTORY_STORAGE_KEY = 'streamvault_watch_history';
const MAX_WATCH_HISTORY_ITEMS = 200; 


const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [pageBeforePlayer, setPageBeforePlayer] = useState<Page>(Page.Home);
  const [profiles, setProfiles] = useState<Profile[]>(DEFAULT_PROFILES); 
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isInitialNavigationDone, setIsInitialNavigationDone] = useState(false);
  
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  
  const [messageBox, setMessageBox] = useState<MessageBoxState>({ isOpen: false, title: '', message: '' });
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false, message: '' });
  const [currentlyPlaying, setCurrentlyPlaying] = useState<CurrentlyPlayingState>({ 
    url: null, title: null, poster: null, contentId: null, type: undefined, originalType: undefined, startTime: undefined,
    seriesId: undefined, seasonNumber: undefined, episodeNumber: undefined, seriesName: undefined, episodeTitle: undefined, group: undefined, year: undefined, playlistName: undefined
  });
  const [resumeModalState, setResumeModalState] = useState<ResumePlaybackModalState>({ isOpen: false, item: null, savedTime: 0 });
  const [confirmRemoveCWModal, setConfirmRemoveCWModal] = useState<ConfirmModalState>({ isOpen: false, title: '', message: '', itemIdToAction: null, onConfirm: () => {} });
  const [confirmClearAllCWModal, setConfirmClearAllCWModal] = useState<ConfirmModalState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  const [nextEpisodeDataForPlayer, setNextEpisodeDataForPlayer] = useState<NextEpisodeDataForPlayerState | null>(null);
  const [lastPlayedTimestamp, setLastPlayedTimestamp] = useState(Date.now()); 
  
  const [watchHistory, setWatchHistory] = useState<ContentItem[]>([]);
  const [rateContentModal, setRateContentModal] = useState<RateContentModalState>({ isOpen: false, item: null });
  const [confirmRemoveHistoryModal, setConfirmRemoveHistoryModal] = useState<ConfirmModalState>({ isOpen: false, title: '', message: '', itemIdToAction: null, onConfirm: () => {} });
  const [confirmClearAllHistoryModal, setConfirmClearAllHistoryModal] = useState<ConfirmModalState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [lastHistoryUpdateTimestamp, setLastHistoryUpdateTimestamp] = useState(Date.now());

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  const [scrollPositions, setScrollPositions] = useState<{[key: string]: number}>({});
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [pageDisplayLimits, setPageDisplayLimits] = useState<Record<string, number>>({});

  const [currentViewedSeries, setCurrentViewedSeries] = useState<{
    playlistName: string | null; 
    seriesItem: ContentItem | null;
    seasons: SeasonInfo[];
    seriesPoster?: string;
  } | null>(null);

  // App Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [editProfileModalState, setEditProfileModalState] = useState<EditProfileModalState>({ isOpen: false, profile: null });
  const [cacheUsageMB, setCacheUsageMB] = useState<string>("Calculating...");
  const [feedbackModalState, setFeedbackModalState] = useState<FeedbackModalState>({ isOpen: false }); 
  const [updateReadyModalState, setUpdateReadyModalState] = useState<UpdateReadyModalState>({ isOpen: false });

  // First Launch Splash Screen State
  const [hasLaunchedBefore, setHasLaunchedBefore] = useState<boolean | null>(null);
  const [splashAnimationComplete, setSplashAnimationComplete] = useState(false);
  const [mainUiVisible, setMainUiVisible] = useState(false);


  const showMessageBox = useCallback((title: string, message: string) => {
    setMessageBox({ isOpen: true, title, message });
  }, []); 

  // Load "hasLaunchedBefore" state from localStorage on mount
  useEffect(() => {
    const launchedFlag = localStorage.getItem(LOCAL_STORAGE_HAS_LAUNCHED_KEY);
    if (launchedFlag === 'true') {
      setHasLaunchedBefore(true);
      setSplashAnimationComplete(true); // Skip animation
      setMainUiVisible(true); // Show UI immediately
    } else {
      setHasLaunchedBefore(false);
    }
  }, []);

  const handleSplashAnimationComplete = useCallback(() => {
    localStorage.setItem(LOCAL_STORAGE_HAS_LAUNCHED_KEY, 'true');
    setSplashAnimationComplete(true);
    setMainUiVisible(true); // Trigger main UI fade-in
  }, []);


  const handleNavigate = useCallback((page: Page, seriesContext?: { seriesItem: ContentItem, playlistName: string }) => {
    const generatingKey = currentPage + (currentViewedSeries?.seriesItem?.id || '') + (currentlyPlaying.contentId || '');
    if (mainContentRef.current && currentPage !== Page.VideoPlayer && currentPage !== page) { 
      setScrollPositions(prev => ({ ...prev, [generatingKey]: mainContentRef.current!.scrollTop }));
    }
    
    if (currentPage === Page.VideoPlayer || page !== Page.VideoPlayer) {
        setCurrentlyPlaying({ url: null, title: null, poster: null, contentId: null, type: undefined, originalType: undefined, startTime: undefined, seriesId: undefined, seasonNumber: undefined, episodeNumber: undefined, seriesName: undefined, episodeTitle: undefined, group: undefined, year: undefined, playlistName: undefined }); 
        setNextEpisodeDataForPlayer(null);
    }
    
    if (page === Page.SeriesDetail && seriesContext?.seriesItem && seriesContext.seriesItem.seriesId) {
      const { seriesItem, playlistName } = seriesContext;
      setCurrentViewedSeries({ seriesItem, playlistName, seasons: [], seriesPoster: seriesItem.poster }); 
      const playlist = playlists.find(p => p.name === playlistName);
      if (playlist && seriesItem.seriesId) {
        fetchXtreamSeriesEpisodes(playlist, seriesItem.seriesId, setLoadingState).then(details => {
          if (details) {
            setCurrentViewedSeries(prev => prev ? { ...prev, seasons: details.seasons, seriesPoster: details.seriesPoster || prev.seriesPoster } : null);
          } else {
            showMessageBox("Error", `Could not load episodes for "${seriesItem.name}". Check console for details.`);
          }
        });
      }
    } else if (page !== Page.SeriesDetail) { 
      setCurrentViewedSeries(null); 
    }
    setCurrentPage(page);
  }, [currentPage, playlists, showMessageBox, setLoadingState, currentViewedSeries, currentlyPlaying.contentId]); 

  useEffect(() => {
    // Wait for hasLaunchedBefore to be determined before loading other data
    if (hasLaunchedBefore === null) return;

    const loadInitialData = async () => {
      setLoadingState({ isLoading: true, message: "Loading saved data..." });
      let loadedSettings = { ...DEFAULT_APP_SETTINGS };
      try {
        const [savedPlaylists, savedHistory, savedSettingsJSON, savedProfiles] = await Promise.all([
          window.electronAPI.loadPlaylists(),
          window.electronAPI.loadWatchHistory(),
          localStorage.getItem(APP_SETTINGS_STORAGE_KEY),
          window.electronAPI.loadProfiles()
        ]);
        if (savedPlaylists) {
          setPlaylists(savedPlaylists);
          console.log("Playlists loaded:", savedPlaylists.length);
        }
        if (savedHistory) {
          setWatchHistory(savedHistory);
          console.log("Watch History loaded:", savedHistory.length);
        }
         if (savedProfiles && savedProfiles.length > 0) { 
          const activeProfileExists = savedProfiles.some(p => p.isActive);
          if (!activeProfileExists) {
            savedProfiles[0].isActive = true;
          }
          setProfiles(savedProfiles.map(p => ({...p, avatarBgColor: p.avatarBgColor || undefined }))); 
          console.log("Profiles loaded:", savedProfiles.length);
        } else {
          setProfiles(DEFAULT_PROFILES.map(p => ({...p, avatarBgColor: p.avatarBgColor || undefined }))); 
          console.log("No saved profiles or empty, using default.");
        }
        if (savedSettingsJSON) {
          try {
            const parsedSettings = JSON.parse(savedSettingsJSON);
            loadedSettings = { ...DEFAULT_APP_SETTINGS, ...parsedSettings };
            console.log("App settings loaded from localStorage.");
          } catch (e) {
            console.error("Error parsing app settings from localStorage", e);
          }
        }
        setAppSettings(loadedSettings);

      } catch (error) {
        console.error("Failed to load initial data:", error);
        showMessageBox("Error Loading Data", "Could not load saved data. Starting fresh.");
        setAppSettings(DEFAULT_APP_SETTINGS);
        setProfiles(DEFAULT_PROFILES.map(p => ({...p, avatarBgColor: p.avatarBgColor || undefined }))); 
      } finally {
        setLoadingState({ isLoading: false, message: "" });
        setInitialLoadComplete(true);
      }
    };
    loadInitialData();
  }, [showMessageBox, hasLaunchedBefore]); 

  useEffect(() => {
    if (initialLoadComplete && !isInitialNavigationDone && appSettings.defaultLaunchSection && hasLaunchedBefore) { // Only navigate if not first launch here
      console.log(`Attempting initial navigation to: ${appSettings.defaultLaunchSection}`);
      if (currentPage === Page.Home && appSettings.defaultLaunchSection !== Page.Home) {
         handleNavigate(appSettings.defaultLaunchSection);
      }
      setIsInitialNavigationDone(true);
    } else if (initialLoadComplete && !hasLaunchedBefore && !isInitialNavigationDone) {
        // For first launch, navigation might be handled after splash, or defaults to Home
        setIsInitialNavigationDone(true); // Mark as done to prevent re-navigation
    }
  }, [initialLoadComplete, appSettings, handleNavigate, isInitialNavigationDone, currentPage, hasLaunchedBefore]);


  useEffect(() => {
    if (initialLoadComplete) { 
      window.electronAPI.savePlaylists(playlists).catch(error => console.error("Failed to save playlists:", error));
    }
  }, [playlists, initialLoadComplete]);

  useEffect(() => {
    if (initialLoadComplete) {
      window.electronAPI.saveWatchHistory(watchHistory).catch(error => console.error("Failed to save watch history:", error));
    }
  }, [watchHistory, initialLoadComplete, lastHistoryUpdateTimestamp]);

  useEffect(() => {
    if (initialLoadComplete) {
      localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
      console.log("App settings saved to localStorage.");
    }
  }, [appSettings, initialLoadComplete]);

  useEffect(() => {
    if (initialLoadComplete) {
      window.electronAPI.saveProfiles(profiles).catch(error => console.error("Failed to save profiles:", error));
      console.log("Profiles saved to main process.");
    }
  }, [profiles, initialLoadComplete]);

  useEffect(() => {
    if (window.electronAPI && typeof window.electronAPI.onUpdateReady === 'function') {
      const cleanup = window.electronAPI.onUpdateReady(() => {
        console.log("Renderer: Received 'update-ready' from main.");
        if (appSettings.enableUpdateNotifications) {
          setUpdateReadyModalState({ isOpen: true });
        }
      });
      return cleanup; 
    }
  }, [appSettings.enableUpdateNotifications]);


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); 
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const allContentItems = useMemo(() => playlists.flatMap(p => p.content), [playlists]);

  const filteredContent = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return allContentItems; 
    const lowerSearchTerm = debouncedSearchTerm.toLowerCase();
    return allContentItems.filter(item => 
      item.name.toLowerCase().includes(lowerSearchTerm) || 
      (item.group && item.group.toLowerCase().includes(lowerSearchTerm))
    );
  }, [allContentItems, debouncedSearchTerm]);
  
  useEffect(() => {
    const newKey = currentPage + (currentViewedSeries?.seriesItem?.id || '') + (currentlyPlaying.contentId || '');
    if (mainContentRef.current && currentPage !== Page.VideoPlayer) {
      const savedScroll = scrollPositions[newKey];
      requestAnimationFrame(() => { 
           if(mainContentRef.current) mainContentRef.current.scrollTop = typeof savedScroll === 'number' ? savedScroll : 0;
      });
    }
  }, [currentPage, currentViewedSeries, filteredContent, watchHistory, scrollPositions, currentlyPlaying.contentId]); 

  const playItem = useCallback((item: ContentItem, startTime?: number) => {
    const sourcePlaylist = playlists.find(p => p.name === item.playlistName);
    if (!item.playlistName || !sourcePlaylist) {
      showMessageBox("Playback Error", `Cannot play "${item.name}". Its source playlist "${item.playlistName || 'Unknown'}" is no longer active or the item is not correctly linked.`);
      return;
    }

    const generatingKey = currentPage + (currentViewedSeries?.seriesItem?.id || '') + (currentlyPlaying.contentId || '');
    if (mainContentRef.current && currentPage !== Page.VideoPlayer) {
      setScrollPositions(prev => ({ ...prev, [generatingKey]: mainContentRef.current!.scrollTop }));
    }
     setPageBeforePlayer(curPage => (curPage === Page.VideoPlayer ? Page.Home : curPage));
     setNextEpisodeDataForPlayer(null);


    if (item.type === 'movie' || item.type === 'episode') {
        const metadataToStore: Partial<ContentItem> = { 
            id: item.id, name: item.name, poster: item.poster, 
            type: item.type as 'movie' | 'episode', 
            url: item.url, 
            seriesId: item.seriesId, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber,
            episodeTitle: item.episodeTitle, seriesName: item.seriesName, group: item.group, 
            year: item.year, originalType: item.originalType || item.type,
            playlistName: item.playlistName, 
        };
        localStorage.setItem(`video-metadata-${item.id}`, JSON.stringify(metadataToStore));
    }
    
    setCurrentlyPlaying({ 
      url: item.url, title: item.name, poster: item.poster, contentId: item.id, 
      type: item.type, 
      originalType: item.originalType || (item.type === 'movie' ? 'movie' : item.type === 'episode' ? 'episode' : item.type === 'channel' ? 'channel' : undefined),
      seriesId: item.seriesId, seasonNumber: item.seasonNumber, episodeNumber: item.episodeNumber,
      seriesName: item.seriesName, episodeTitle: item.episodeTitle,
      group: item.group, year: item.year,
      startTime: startTime,
      playlistName: item.playlistName, 
    });
    setCurrentPage(Page.VideoPlayer); 
  }, [currentPage, currentViewedSeries, currentlyPlaying.contentId, playlists, showMessageBox]);


  const handlePlayContent = useCallback((item: ContentItem, playlistNameContext?: string) => {
    let itemToPlay = { ...item };
    if (!itemToPlay.playlistName && playlistNameContext) {
        itemToPlay.playlistName = playlistNameContext;
    } else if (!itemToPlay.playlistName) {
        const foundInAllContent = allContentItems.find(ci => ci.id === item.id);
        if (foundInAllContent?.playlistName) {
            itemToPlay.playlistName = foundInAllContent.playlistName;
        } else {
            if (playlists.length === 1) {
                itemToPlay.playlistName = playlists[0].name;
            } else {
                 if (item.type === 'series' && item.url.startsWith(SERIES_PLACEHOLDER_URL_PREFIX)) {
                    let foundPlaylistNameForSeries: string | undefined;
                    for (const p of playlists) {
                        if (p.content.some(ci => ci.id === item.id && ci.type === 'series')) {
                            foundPlaylistNameForSeries = p.name;
                            break;
                        }
                    }
                    if (foundPlaylistNameForSeries) {
                        itemToPlay.playlistName = foundPlaylistNameForSeries;
                    } else {
                        showMessageBox("Error", `Could not determine the source playlist for series "${item.name}".`);
                        return;
                    }
                }
            }
        }
    }


    if (itemToPlay.type === 'series' && itemToPlay.seriesId && itemToPlay.url.startsWith(SERIES_PLACEHOLDER_URL_PREFIX)) {
        if (!itemToPlay.playlistName) { 
             showMessageBox("Error", `Source playlist for series "${itemToPlay.name}" is missing.`);
             return;
        }
        setPageBeforePlayer(currentPage);
        handleNavigate(Page.SeriesDetail, { seriesItem: itemToPlay, playlistName: itemToPlay.playlistName });
        return;
    }
    
    setPageBeforePlayer(currentPage); 

    if (itemToPlay.type === 'movie' || itemToPlay.type === 'episode' || itemToPlay.type === 'channel') { 
      const savedTimeStr = localStorage.getItem(`video-time-${itemToPlay.id}`);
      const savedDurationStr = localStorage.getItem(`video-duration-${itemToPlay.id}`);
      if (itemToPlay.type !== 'channel' && savedTimeStr && savedDurationStr) { 
        const savedTime = parseFloat(savedTimeStr);
        const savedDuration = parseFloat(savedDurationStr);
        if (isFinite(savedTime) && isFinite(savedDuration) && savedTime > 0.5 && savedTime < savedDuration * 0.98) {
          setResumeModalState({ isOpen: true, item: itemToPlay, savedTime: savedTime });
          return; 
        }
      }
    }
    playItem(itemToPlay, 0); 
  }, [playlists, playItem, handleNavigate, currentPage, showMessageBox, allContentItems]); 

  const handleResumeFromModal = useCallback((item: ContentItem, time: number) => {
    setResumeModalState({ isOpen: false, item: null, savedTime: 0 });
    playItem(item, time);
  }, [playItem]);

  const handleStartOverFromModal = useCallback((item: ContentItem) => {
    setResumeModalState({ isOpen: false, item: null, savedTime: 0 });
    localStorage.removeItem(`video-time-${item.id}`);
    localStorage.removeItem(`video-duration-${item.id}`);
    localStorage.removeItem(`video-saved-once-${item.id}`); 
    localStorage.removeItem(`video-lastPlayed-${item.id}`);
    playItem(item, 0);
    setLastPlayedTimestamp(Date.now()); 
  }, [playItem]);
  
  const executeRemoveFromContinueWatching = useCallback((itemId: string) => {
    localStorage.removeItem(`video-time-${itemId}`);
    localStorage.removeItem(`video-duration-${itemId}`);
    localStorage.removeItem(`video-metadata-${itemId}`);
    localStorage.removeItem(`video-saved-once-${itemId}`); 
    localStorage.removeItem(`video-lastPlayed-${itemId}`); 
    setLastPlayedTimestamp(Date.now()); 
    showMessageBox("Removed", "Item removed from Continue Watching.");
    setConfirmRemoveCWModal({ isOpen: false, title: '', message: '', itemIdToAction: null, onConfirm: () => {} });
  }, [showMessageBox]);

  const handleRemoveFromContinueWatching = useCallback((item: ContentItem) => {
    setConfirmRemoveCWModal({
        isOpen: true, title: "Confirm Removal",
        message: `Are you sure you want to remove "${item.name}" from Continue Watching?`,
        itemIdToAction: item.id, onConfirm: () => executeRemoveFromContinueWatching(item.id)
    });
  }, [executeRemoveFromContinueWatching]);

  const executeClearAllContinueWatching = useCallback(() => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && ( key.startsWith('video-time-') || key.startsWith('video-duration-') || key.startsWith('video-metadata-') || key.startsWith('video-saved-once-') || key.startsWith('video-lastPlayed-'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    setLastPlayedTimestamp(Date.now());
    showMessageBox("Cleared", "All items removed from Continue Watching.");
    setConfirmClearAllCWModal(prev => ({ ...prev, isOpen: false }));
  }, [showMessageBox]);

  const handleRequestClearAllContinueWatching = useCallback(() => {
    setConfirmClearAllCWModal({
        isOpen: true, title: "Confirm Clear All",
        message: "Are you sure you want to clear all items from Continue Watching? This action cannot be undone.",
        onConfirm: executeClearAllContinueWatching
    });
  }, [executeClearAllContinueWatching]);

  const handleViewSeriesDetailFromCW = useCallback((seriesData: { seriesId: string, seriesName: string, poster?: string }) => {
    let foundPlaylistName: string | null = null;
    const seriesShellItemInAllContent = allContentItems.find(item => item.type === 'series' && item.seriesId === seriesData.seriesId);

    if (seriesShellItemInAllContent?.playlistName) {
        foundPlaylistName = seriesShellItemInAllContent.playlistName;
    } else {
        for (const playlist of playlists) {
            const foundSeries = playlist.content.find( (item) => item.type === 'series' && item.seriesId === seriesData.seriesId );
            if (foundSeries) { foundPlaylistName = playlist.name; break; }
        }
    }

    if (foundPlaylistName) {
        const seriesShellItem: ContentItem = {
            id: seriesData.seriesId, type: 'series', name: seriesData.seriesName,
            url: `${SERIES_PLACEHOLDER_URL_PREFIX}${seriesData.seriesId}`, 
            poster: seriesData.poster, seriesId: seriesData.seriesId, 
            playlistName: foundPlaylistName 
        };
        setPageBeforePlayer(currentPage); 
        handleNavigate(Page.SeriesDetail, { seriesItem: seriesShellItem, playlistName: foundPlaylistName });
    } else {
        showMessageBox("Error", `Could not find the original playlist for series "${seriesData.seriesName}".`);
    }
  }, [playlists, handleNavigate, currentPage, showMessageBox, allContentItems]);

  const handleClosePlayer = useCallback(() => {
    setCurrentPage(prevCurrentPage => {
        const targetPage = (pageBeforePlayer && pageBeforePlayer !== Page.VideoPlayer) ? pageBeforePlayer : Page.Home;
        return targetPage;
    });
    setCurrentlyPlaying({ url: null, title: null, poster: null, contentId: null, type: undefined, originalType: undefined, startTime: undefined, seriesId: undefined, seasonNumber: undefined, episodeNumber: undefined, seriesName: undefined, episodeTitle: undefined, group: undefined, year: undefined, playlistName: undefined });
    setNextEpisodeDataForPlayer(null); 
    setLastPlayedTimestamp(Date.now()); 
    setLastHistoryUpdateTimestamp(Date.now()); 
  }, [pageBeforePlayer]);

  const handleEarlySave = useCallback(() => {
    setLastPlayedTimestamp(Date.now());
  }, []);

    const findAndSetNextEpisode = useCallback((endedEpisodeData: { contentId: string, seriesId?: string, seasonNumber?: number, episodeNumber?: number, seriesName?: string, poster?: string, playlistName?: string }, seasons: SeasonInfo[], seriesName?: string, seriesPoster?: string) => {
        const currentSeason = seasons.find(s => s.season_number === endedEpisodeData.seasonNumber);
        if (!currentSeason || typeof endedEpisodeData.seasonNumber !== 'number' || typeof endedEpisodeData.episodeNumber !== 'number') return;

        const currentEpisodeIndex = currentSeason.episodes.findIndex(ep => ep.episode === endedEpisodeData.episodeNumber);
        if (currentEpisodeIndex === -1) return;

        let nextEpisode: EpisodeInfo | null = null;
        let nextSeasonNumber = endedEpisodeData.seasonNumber;

        if (currentEpisodeIndex < currentSeason.episodes.length - 1) {
            nextEpisode = currentSeason.episodes[currentEpisodeIndex + 1];
        } else {
            const nextSeasonInOrder = seasons.find(s => s.season_number === endedEpisodeData.seasonNumber! + 1);
            if (nextSeasonInOrder && nextSeasonInOrder.episodes.length > 0) {
                nextEpisode = nextSeasonInOrder.episodes[0];
                nextSeasonNumber = nextSeasonInOrder.season_number;
            }
        }

        if (nextEpisode) {
            const nextEpisodeToPlayItem: ContentItem = {
                id: nextEpisode.id, type: 'episode',
                name: `${seriesName || endedEpisodeData.seriesName} - S${String(nextSeasonNumber).padStart(2, '0')}E${String(nextEpisode.episode).padStart(2, '0')} - ${nextEpisode.title}`,
                url: nextEpisode.url || '', poster: nextEpisode.poster || seriesPoster || endedEpisodeData.poster,
                seriesId: endedEpisodeData.seriesId, seasonNumber: nextSeasonNumber, episodeNumber: nextEpisode.episode,
                seriesName: seriesName || endedEpisodeData.seriesName, episodeTitle: nextEpisode.title, originalType: 'episode',
                playlistName: endedEpisodeData.playlistName, 
            };
            setNextEpisodeDataForPlayer({ nextEpisode: nextEpisodeToPlayItem, seriesName: seriesName || endedEpisodeData.seriesName, seriesPoster: seriesPoster || endedEpisodeData.poster });
        } else {
            showMessageBox("Series End", `You've finished all available episodes of ${seriesName || endedEpisodeData.seriesName}.`);
        }
    }, [showMessageBox]);

    const handleEpisodeEnd = useCallback((endedEpisodeData: { contentId: string, seriesId?: string, seasonNumber?: number, episodeNumber?: number, seriesName?: string, poster?: string, playlistName?:string }) => {
        if (!endedEpisodeData.seriesId || typeof endedEpisodeData.seasonNumber !== 'number' || typeof endedEpisodeData.episodeNumber !== 'number') return; 
        
        const isCurrentViewedSeriesContext = currentViewedSeries?.seriesItem?.seriesId === endedEpisodeData.seriesId;
        let resolvedSeriesItem: ContentItem | null | undefined = null;
        let resolvedSeasons: SeasonInfo[] | undefined = undefined;
        let resolvedSeriesName: string | undefined = endedEpisodeData.seriesName; 
        let resolvedSeriesPoster: string | undefined = endedEpisodeData.poster; 

        if (isCurrentViewedSeriesContext && currentViewedSeries?.seriesItem) {
            resolvedSeriesItem = currentViewedSeries.seriesItem; resolvedSeasons = currentViewedSeries.seasons;
            resolvedSeriesName = currentViewedSeries.seriesItem.name; resolvedSeriesPoster = currentViewedSeries.seriesPoster || currentViewedSeries.seriesItem.poster;
        } else {
            resolvedSeriesItem = allContentItems.find(s => s.type === 'series' && s.seriesId === endedEpisodeData.seriesId);
            if (resolvedSeriesItem) {
                resolvedSeasons = resolvedSeriesItem.seasons; resolvedSeriesName = resolvedSeriesItem.name; resolvedSeriesPoster = resolvedSeriesItem.poster;
            }
        }
        if (!resolvedSeriesItem || !resolvedSeriesItem.seriesId) return;
        const seasonsToSearch = resolvedSeasons;
        const effectivePlaylistName = endedEpisodeData.playlistName || resolvedSeriesItem.playlistName;

        if (!effectivePlaylistName) {
            showMessageBox("Error", "Cannot determine source playlist to fetch next episode.");
            return;
        }

        if (!seasonsToSearch || seasonsToSearch.length === 0) {
            const playlist = playlists.find(p => p.name === effectivePlaylistName);
            if (playlist && resolvedSeriesItem) { 
                 fetchXtreamSeriesEpisodes(playlist, endedEpisodeData.seriesId, setLoadingState).then(details => {
                    if (details && details.seasons.length > 0) {
                        if (isCurrentViewedSeriesContext && currentViewedSeries && resolvedSeriesItem) {
                             setCurrentViewedSeries({ ...currentViewedSeries, seriesItem: resolvedSeriesItem, seasons: details.seasons, seriesPoster: details.seriesPoster || currentViewedSeries.seriesPoster || resolvedSeriesItem.poster });
                        }
                        findAndSetNextEpisode({...endedEpisodeData, playlistName: effectivePlaylistName}, details.seasons, resolvedSeriesItem.name || endedEpisodeData.seriesName, details.seriesPoster || resolvedSeriesPoster);
                    } else { showMessageBox("Series End", `You've finished all available episodes of ${resolvedSeriesName || 'this series'}.`); }
                });
            } else { showMessageBox("Series End", `You've finished all available episodes of ${resolvedSeriesName || 'this series'}.`); }
            return;
        }
        findAndSetNextEpisode({...endedEpisodeData, playlistName: effectivePlaylistName}, seasonsToSearch, resolvedSeriesName, resolvedSeriesPoster);
    }, [currentViewedSeries, playlists, showMessageBox, setLoadingState, findAndSetNextEpisode, allContentItems]);

    const handleRequestPlayNextEpisode = useCallback((itemToPlay: ContentItem) => {
        playItem(itemToPlay); setNextEpisodeDataForPlayer(null); 
    }, [playItem]);
    const handleNextEpisodeDataConsumed = useCallback(() => setNextEpisodeDataForPlayer(null), []);

  const addPlaylistCallback = useCallback(async (type: 'm3u' | 'xtream', details: { name: string, url?: string, m3uFileContent?: string, serverUrl?: string, username?: string, password?: string }) => {
    const newContent = await handleAddPlaylist(type, details, setLoadingState, showMessageBox);
    if (newContent) {
      const newPlaylist: Playlist = {
        type, name: details.name, content: newContent, 
        ...(type === 'm3u' && details.url && { url: details.url }), 
        ...(type === 'xtream' && { serverUrl: details.serverUrl, username: details.username, password: details.password }),
      };
      setPlaylists(prev => {
        const existingPlaylistIndex = prev.findIndex(p => p.name === newPlaylist.name);
        if (existingPlaylistIndex > -1) {
          const updatedPlaylists = [...prev]; updatedPlaylists[existingPlaylistIndex] = newPlaylist; return updatedPlaylists;
        }
        return [...prev, newPlaylist]; 
      });
      handleNavigate(Page.Playlists); 
    }
  }, [handleNavigate, showMessageBox]);

  const removePlaylistCallback = useCallback((playlistName: string) => {
    setPlaylists(prev => prev.filter(p => p.name !== playlistName));
    setWatchHistory(prevHistory => prevHistory.filter(whItem => whItem.playlistName !== playlistName));
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('video-metadata-')) {
            const metadataStr = localStorage.getItem(key);
            if (metadataStr) {
                try {
                    const storedItem = JSON.parse(metadataStr) as Partial<ContentItem>;
                    if (storedItem.playlistName === playlistName) {
                        const itemId = key.substring('video-metadata-'.length);
                        localStorage.removeItem(key); 
                        localStorage.removeItem(`video-time-${itemId}`);
                        localStorage.removeItem(`video-duration-${itemId}`);
                        localStorage.removeItem(`video-saved-once-${itemId}`);
                        localStorage.removeItem(`video-lastPlayed-${itemId}`);
                        localStorage.removeItem(`video-marked-watched-${itemId}`);
                    }
                } catch (e) {
                    console.error("Error parsing localStorage item during playlist removal:", e);
                }
            }
        }
    }
    setLastPlayedTimestamp(Date.now()); 
    setLastHistoryUpdateTimestamp(Date.now()); 
    showMessageBox('Playlist Removed', `The playlist "${playlistName}" has been removed along with its associated watch data.`);
  }, [showMessageBox]);

  const handleRefreshPlaylist = useCallback(async (playlistName: string) => {
    const playlistToRefresh = playlists.find(p => p.name === playlistName);
    if (!playlistToRefresh) { showMessageBox("Error", "Playlist not found."); return; }
    let type: 'm3u' | 'xtream' = playlistToRefresh.type;
    let details: any = { name: playlistToRefresh.name }; 
    if (playlistToRefresh.type === 'm3u' && playlistToRefresh.url) details.url = playlistToRefresh.url;
    else if (playlistToRefresh.type === 'xtream' && playlistToRefresh.serverUrl && playlistToRefresh.username && playlistToRefresh.password) {
        details.serverUrl = playlistToRefresh.serverUrl; details.username = playlistToRefresh.username; details.password = playlistToRefresh.password;
    } else { showMessageBox("Cannot Refresh", `Playlist "${playlistName}" cannot be automatically refreshed.`); return; }
    setLoadingState({isLoading: true, message: `Refreshing playlist "${playlistName}"...`});
    const newContent = await handleAddPlaylist(type, details, setLoadingState, showMessageBox); 
    setLoadingState({isLoading: false, message: ""});
    if (newContent) setPlaylists(prev => prev.map(p => p.name === playlistName ? { ...p, content: newContent } : p ));
  }, [playlists, setLoadingState, showMessageBox]);
  
  const markItemAsWatched = useCallback((playedContentId: string) => {
    const itemPlayedFromCurrentlyPlaying = (currentlyPlaying.contentId === playedContentId && currentlyPlaying.playlistName) ? {
        id: currentlyPlaying.contentId!, type: currentlyPlaying.type!, name: currentlyPlaying.title!, url: currentlyPlaying.url!,
        poster: currentlyPlaying.poster, seriesId: currentlyPlaying.seriesId, seasonNumber: currentlyPlaying.seasonNumber,
        episodeNumber: currentlyPlaying.episodeNumber, seriesName: currentlyPlaying.seriesName, episodeTitle: currentlyPlaying.episodeTitle,
        group: currentlyPlaying.group, year: currentlyPlaying.year, originalType: currentlyPlaying.originalType, playlistName: currentlyPlaying.playlistName,
    } as ContentItem : null;

    const itemPlayedFromAllContent = allContentItems.find(i => i.id === playedContentId);
    const itemPlayed = itemPlayedFromCurrentlyPlaying || itemPlayedFromAllContent || watchHistory.find(i => i.id === playedContentId);

    if (!itemPlayed || itemPlayed.type === 'channel' || !itemPlayed.playlistName) { 
      console.warn("Could not mark item as watched or item is a channel or missing playlistName:", itemPlayed);
      return;
    }

    setWatchHistory(prevHistory => {
        const now = Date.now();
        const existingEntry = prevHistory.find(hItem => hItem.id === itemPlayed.id);
        const newItemData: ContentItem = {
            ...itemPlayed, watchedOn: now, userRating: existingEntry?.userRating || itemPlayed.userRating, 
            originalType: itemPlayed.originalType || (itemPlayed.type === 'episode' ? 'episode' : (itemPlayed.type === 'movie' ? 'movie' : undefined)),
            playlistName: itemPlayed.playlistName, 
        };
        delete newItemData.progress;
        const filteredHistory = prevHistory.filter(hItem => hItem.id !== itemPlayed.id);
        const updatedHistory = [newItemData, ...filteredHistory].slice(0, MAX_WATCH_HISTORY_ITEMS);
        return updatedHistory;
    });
    setLastHistoryUpdateTimestamp(Date.now());
  }, [allContentItems, currentlyPlaying, watchHistory]);

  const handleOpenRateModal = useCallback((item: ContentItem) => setRateContentModal({ isOpen: true, item }), []);
  
  const handleSaveRating = useCallback((itemId: string, rating: number) => {
    setWatchHistory(prev => prev.map(item => item.id === itemId ? { ...item, userRating: rating } : item));
    setRateContentModal({ isOpen: false, item: null });
    showMessageBox("Rating Saved", `Your rating for the item has been saved.`);
    setLastHistoryUpdateTimestamp(Date.now());
  }, [showMessageBox]);

  const executeRemoveFromHistory = useCallback((itemId: string) => {
    setWatchHistory(prev => prev.filter(item => item.id !== itemId));
    showMessageBox("Removed", "Item removed from Watched History.");
    setConfirmRemoveHistoryModal({ isOpen: false, title: '', message: '', itemIdToAction: null, onConfirm: () => {} });
    setLastHistoryUpdateTimestamp(Date.now());
  }, [showMessageBox]);

  const handleRemoveFromHistory = useCallback((item: ContentItem) => {
    setConfirmRemoveHistoryModal({
        isOpen: true, title: "Confirm Removal",
        message: `Are you sure you want to remove "${item.name}" from your Watched History?`,
        itemIdToAction: item.id, onConfirm: () => executeRemoveFromHistory(item.id)
    });
  }, [executeRemoveFromHistory]);

  const executeClearAllWatchHistory = useCallback(() => {
    setWatchHistory([]);
    showMessageBox("Cleared", "Watched History has been cleared.");
    setConfirmClearAllHistoryModal(prev => ({ ...prev, isOpen: false }));
    setLastHistoryUpdateTimestamp(Date.now());
  }, [showMessageBox]);

  const handleRequestClearAllWatchHistory = useCallback(() => {
    setConfirmClearAllHistoryModal({
        isOpen: true, title: "Confirm Clear History",
        message: "Are you sure you want to clear your entire Watched History? This action cannot be undone.",
        onConfirm: executeClearAllWatchHistory
    });
  }, [executeClearAllWatchHistory]);


  const handleAppSettingsChange = useCallback((settingName: keyof AppSettings, value: any) => {
    setAppSettings(prevSettings => ({ ...prevSettings, [settingName]: value }));
  }, []);

  const handleOpenEditProfileModal = useCallback(() => {
    const activeProfile = profiles.find(p => p.isActive) || profiles[0] || DEFAULT_PROFILES[0];
    setEditProfileModalState({ isOpen: true, profile: activeProfile });
  }, [profiles]);

  const handleSaveProfile = useCallback((updatedProfile: Profile) => {
    setProfiles(prevProfiles =>
      prevProfiles.map(p => p.id === updatedProfile.id ? { ...updatedProfile, isActive: true } : { ...p, isActive: false })
    );
    showMessageBox("Profile Updated", `Profile "${updatedProfile.name}" has been saved.`);
    setEditProfileModalState({ isOpen: false, profile: null });
  }, [showMessageBox]);

  const handleResetProfile = useCallback(() => {
    setProfiles(prevProfiles => {
      const activeProfileIndex = prevProfiles.findIndex(p => p.isActive);
      if (activeProfileIndex === -1) { showMessageBox("Error", "No active profile found to reset."); return prevProfiles; }
      const activeProfileId = prevProfiles[activeProfileIndex].id;
      const defaultProfileData = DEFAULT_PROFILES.find(dp => dp.id === activeProfileId);
      const baseDefault = DEFAULT_PROFILES[0] || { id: 1, name: 'Profile', avatar: DEFAULT_USER_ICON_ID, isActive: true, avatarBgColor: undefined };
      const resetData = defaultProfileData || baseDefault;
      const updatedProfiles = [...prevProfiles];
      updatedProfiles[activeProfileIndex] = { ...updatedProfiles[activeProfileIndex], name: resetData.name, avatar: resetData.avatar, avatarBgColor: resetData.avatarBgColor };
      return updatedProfiles;
    });
    showMessageBox("Profile Reset", "Your profile has been reset to its default settings.");
  }, [showMessageBox]);
  
  const fetchCacheUsage = useCallback(async () => {
    setCacheUsageMB("Calculating...");
    try { const bytes = await window.electronAPI.getCacheSize(); setCacheUsageMB(`${(bytes / (1024 * 1024)).toFixed(2)} MB`); } 
    catch (error) { console.error("Failed to get cache size:", error); setCacheUsageMB("Error"); }
  }, []);

  useEffect(() => { if (currentPage === Page.Settings && initialLoadComplete) fetchCacheUsage(); }, [currentPage, initialLoadComplete, fetchCacheUsage]);

  const handleClearCache = useCallback(async () => {
    setLoadingState({ isLoading: true, message: "Clearing cache..." });
    try { await window.electronAPI.clearAppCache(); showMessageBox("Cache Cleared", "Application cache has been cleared."); await fetchCacheUsage(); } 
    catch (error: any) { console.error("Failed to clear cache:", error); showMessageBox("Error Clearing Cache", error.message || "Failed to clear application cache."); } 
    finally { setLoadingState({ isLoading: false, message: "" }); }
  }, [showMessageBox, fetchCacheUsage]);
  
  const handleOpenFeedbackModal = useCallback(() => setFeedbackModalState({ isOpen: true }), []);
  const handleRestartAndUpdate = useCallback(() => { if (window.electronAPI?.quitAndInstall) window.electronAPI.quitAndInstall(); setUpdateReadyModalState({ isOpen: false }); }, []);
  const handleUpdateLater = useCallback(() => setUpdateReadyModalState({ isOpen: false }), []);

  const memoizedContinueWatchingItems = useMemo(() => {
    const rawCWItems = getConsolidatedContinueWatchingItems();
    return rawCWItems.filter(cwItem => playlists.some(p => p.name === cwItem.playlistName));
  }, [lastPlayedTimestamp, playlists]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentPage === Page.VideoPlayer || rateContentModal.isOpen || confirmClearAllHistoryModal.isOpen || confirmRemoveHistoryModal.isOpen || isPlaylistModalOpen || messageBox.isOpen || resumeModalState.isOpen || confirmRemoveCWModal.isOpen || confirmClearAllCWModal.isOpen || editProfileModalState.isOpen || feedbackModalState.isOpen || updateReadyModalState.isOpen ) return;

      if (e.ctrlKey || e.metaKey) { 
        switch (e.key) {
          case '1': handleNavigate(Page.Home); break; case '2': handleNavigate(Page.LiveTV); break;
          case '3': handleNavigate(Page.Movies); break; case '4': handleNavigate(Page.Series); break;
          case '5': handleNavigate(Page.WatchedHistory); break; 
          case 'f': e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder="Search movies, series, channels..."]')?.focus(); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, handleNavigate, rateContentModal.isOpen, confirmClearAllHistoryModal.isOpen, confirmRemoveHistoryModal.isOpen, isPlaylistModalOpen, messageBox.isOpen, resumeModalState.isOpen, confirmRemoveCWModal.isOpen, confirmClearAllCWModal.isOpen, editProfileModalState.isOpen, feedbackModalState.isOpen, updateReadyModalState.isOpen]); 

  const memoizedSetDisplayLimit = useCallback((limit: number) => {
    const generatingKey = currentPage + (currentViewedSeries?.seriesItem?.id || '') + (currentlyPlaying.contentId || '');
    setPageDisplayLimits(prev => ({ ...prev, [generatingKey]: limit }));
  }, [currentPage, currentViewedSeries, currentlyPlaying.contentId]);

  const activeProfile = useMemo(() => profiles.find(p => p.isActive) || profiles[0] || DEFAULT_PROFILES[0], [profiles]);
  const isFirstPlaylistAdded = playlists.length > 0;

  const renderPageContent = () => { 
    if (currentPage === Page.VideoPlayer && currentlyPlaying.url && currentlyPlaying.title) {
      return <VideoPlayer 
                url={currentlyPlaying.url} title={currentlyPlaying.title} poster={currentlyPlaying.poster} 
                contentId={currentlyPlaying.contentId} startTime={currentlyPlaying.startTime}
                onClose={handleClosePlayer} onEarlySave={handleEarlySave} onMarkAsWatched={markItemAsWatched}
                itemType={currentlyPlaying.type} seriesId={currentlyPlaying.seriesId}
                seasonNumber={currentlyPlaying.seasonNumber} episodeNumber={currentlyPlaying.episodeNumber}
                seriesNameProp={currentlyPlaying.seriesName} onEpisodeEnd={handleEpisodeEnd} 
                nextEpisodeDataProp={nextEpisodeDataForPlayer}
                onRequestPlayNextEpisode={handleRequestPlayNextEpisode}
                onNextEpisodeDataConsumed={handleNextEpisodeDataConsumed}
             />;
    }
    
    if (currentPage === Page.SeriesDetail && currentViewedSeries?.seriesItem) {
      const seriesPlaylistName = currentViewedSeries.playlistName || playlists.find(p => p.content.some(ci => ci.id === currentViewedSeries.seriesItem?.id))?.name;
      return <SeriesDetailPageView 
                seriesItem={currentViewedSeries.seriesItem} seasons={currentViewedSeries.seasons}
                seriesPoster={currentViewedSeries.seriesPoster}
                onPlayEpisode={(episodeItem) => handlePlayContent( {...episodeItem, seriesName: currentViewedSeries.seriesItem?.name, playlistName: seriesPlaylistName }, seriesPlaylistName )} 
                onBack={() => handleNavigate(pageBeforePlayer && pageBeforePlayer !== Page.SeriesDetail ? pageBeforePlayer : Page.Series)} 
                isLoading={loadingState.isLoading && loadingState.message.includes("Fetching episodes")}
             />;
    }
    const uniquePageKey = currentPage + (currentViewedSeries?.seriesItem?.id || '') + (currentlyPlaying.contentId || '');
    const pageViewProps: GlobalPageViewProps = {
      activeProfile, playlists, watchHistory, filteredContent, 
      onPlayContent: (item) => handlePlayContent(item, item.playlistName || playlists.find(p => p.content.some(ci => ci.id === item.id))?.name), 
      onNavigate: handleNavigate, onAddPlaylist: () => setIsPlaylistModalOpen(true),
      onRemovePlaylist: removePlaylistCallback, onRefreshPlaylist: handleRefreshPlaylist, 
      lastPlayedTimestamp: lastPlayedTimestamp, onRemoveFromContinueWatching: handleRemoveFromContinueWatching,
      onRequestClearAllContinueWatching: handleRequestClearAllContinueWatching,
      onViewSeriesDetail: handleViewSeriesDetailFromCW, 
      displayLimit: pageDisplayLimits[uniquePageKey] || INITIAL_ITEMS_TO_SHOW_GENERIC_CONTENT,
      onSetDisplayLimit: memoizedSetDisplayLimit, onRateContent: handleOpenRateModal,
      onRemoveFromHistory: handleRemoveFromHistory,
      onRequestClearAllWatchHistory: handleRequestClearAllWatchHistory,
      appSettings: appSettings, onAppSettingsChange: handleAppSettingsChange,
      onOpenEditProfileModal: handleOpenEditProfileModal, onClearCache: handleClearCache,
      cacheUsageMB: cacheUsageMB, onResetProfile: handleResetProfile, 
      showMessageBox: showMessageBox, onOpenFeedbackModal: handleOpenFeedbackModal, 
      isFirstPlaylistAdded: isFirstPlaylistAdded, 
    };

    switch (currentPage) {
      case Page.Home: return <HomePageView {...pageViewProps} continueWatchingItems={memoizedContinueWatchingItems} />;
      case Page.LiveTV: return <LiveTVPageView {...pageViewProps} />;
      case Page.Movies: return <MoviesPageView {...pageViewProps} />;
      case Page.Series: return <SeriesPageView {...pageViewProps} />;
      case Page.WatchedHistory: return <WatchHistoryPageView {...pageViewProps} />; 
      case Page.Playlists: return <PlaylistsPageView {...pageViewProps} />;
      case Page.Settings: return <SettingsPageView {...pageViewProps} />;
      case Page.ContinueWatchingAll: return <ContinueWatchingAllPageView {...pageViewProps} continueWatchingItems={memoizedContinueWatchingItems} />; 
      default: handleNavigate(Page.Home); return <HomePageView {...pageViewProps} continueWatchingItems={memoizedContinueWatchingItems} />;
    }
  };
  
  const pageTransitionKey = useMemo(() => currentPage + (currentViewedSeries?.seriesItem?.id || '') + (currentlyPlaying.contentId || ''), [currentPage, currentViewedSeries, currentlyPlaying.contentId]);

  // Handle Splash Screen display
  if (hasLaunchedBefore === null) {
    return <div className="fixed inset-0 bg-sv-bg-deep flex items-center justify-center z-[100]"><SpinnerIcon className="w-12 h-12 text-sv-accent-cyan"/></div>; // Basic loading before localStorage check
  }
  if (!hasLaunchedBefore && !splashAnimationComplete) {
    return <SplashScreen onAnimationComplete={handleSplashAnimationComplete} />;
  }

  const mainContentPaneClasses = currentPage !== Page.VideoPlayer 
    ? 'bg-sv-glass-mainpane backdrop-blur-xl shadow-2xl rounded-tl-3xl my-3 mr-3 border border-sv-border-glass'
    : 'bg-sv-bg-deep';

  return (
    <motion.div 
      className="flex h-screen bg-sv-bg-deep text-sv-text-primary overflow-hidden" // Changed bg-sv-bg-primary to sv-bg-deep
      initial={{ opacity: 0 }}
      animate={{ opacity: mainUiVisible ? 1 : 0 }}
      transition={{ duration: 0.5 }}
    >
      { currentPage !== Page.VideoPlayer && <Sidebar currentPage={currentPage} onNavigate={handleNavigate} /> }
      <main 
        className={`flex-1 flex flex-col overflow-hidden ${mainContentPaneClasses}`}
      >
        { currentPage !== Page.VideoPlayer && 
            <Header 
                searchTerm={searchTerm} 
                onSearchTermChange={setSearchTerm}
                profiles={profiles} 
                isFirstPlaylistAdded={isFirstPlaylistAdded}
            /> 
        }
        <div 
          key={pageTransitionKey} 
          ref={mainContentRef} 
          className="flex-1 overflow-y-auto animate-fadeInUp" 
        >
          {renderPageContent()}
        </div>
      </main>

      <PlaylistModal isOpen={isPlaylistModalOpen} onClose={() => setIsPlaylistModalOpen(false)} onAddPlaylist={addPlaylistCallback} />
      <MessageBox isOpen={messageBox.isOpen} title={messageBox.title} message={messageBox.message} onClose={() => setMessageBox(prev => ({ ...prev, isOpen: false }))} />
      <ResumePlaybackModal modalState={resumeModalState} onClose={() => setResumeModalState({ isOpen: false, item: null, savedTime: 0 })} onResume={handleResumeFromModal} onStartOver={handleStartOverFromModal} />
      <ConfirmDeleteModal isOpen={confirmRemoveCWModal.isOpen} title={confirmRemoveCWModal.title} message={confirmRemoveCWModal.message} onConfirm={confirmRemoveCWModal.onConfirm} onCancel={() => setConfirmRemoveCWModal(prev => ({ ...prev, isOpen: false, itemIdToAction: null }))} />
      <ConfirmDeleteModal isOpen={confirmClearAllCWModal.isOpen} title={confirmClearAllCWModal.title} message={confirmClearAllCWModal.message} onConfirm={confirmClearAllCWModal.onConfirm} onCancel={() => setConfirmClearAllCWModal(prev => ({ ...prev, isOpen: false }))} />
      
      <RateContentModal modalState={rateContentModal} onClose={() => setRateContentModal({ isOpen: false, item: null})} onSaveRating={handleSaveRating} />
      <ConfirmDeleteModal isOpen={confirmRemoveHistoryModal.isOpen} title={confirmRemoveHistoryModal.title} message={confirmRemoveHistoryModal.message} onConfirm={confirmRemoveHistoryModal.onConfirm} onCancel={() => setConfirmRemoveHistoryModal(prev => ({ ...prev, isOpen: false, itemIdToAction: null }))} />
      <ConfirmDeleteModal isOpen={confirmClearAllHistoryModal.isOpen} title={confirmClearAllHistoryModal.title} message={confirmClearAllHistoryModal.message} onConfirm={confirmClearAllHistoryModal.onConfirm} onCancel={() => setConfirmClearAllHistoryModal(prev => ({ ...prev, isOpen: false }))} />
      
      <EditProfileModal
        modalState={editProfileModalState}
        onClose={() => setEditProfileModalState({ isOpen: false, profile: null })}
        onSaveProfile={handleSaveProfile}
      />
      
      <FeedbackModal 
        modalState={feedbackModalState}
        onClose={() => setFeedbackModalState({ isOpen: false })}
      />

      <UpdateReadyModal 
        modalState={updateReadyModalState}
        onClose={handleUpdateLater}
        onRestart={handleRestartAndUpdate}
      />

      <LoadingOverlay isLoading={loadingState.isLoading} message={loadingState.message} />
    </motion.div>
  );
};

export default App;
