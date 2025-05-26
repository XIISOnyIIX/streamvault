
import React, { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { RewindIcon, FastForwardIcon, FilmIcon, TvIcon } from './common/Icons'; 
import { ContentItem, NextEpisodeDataForPlayerState } from '../types';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  contentId?: string; 
  startTime?: number; 
  onEarlySave?: () => void; 
  
  itemType?: ContentItem['type'];
  seriesId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  seriesNameProp?: string; 
  onEpisodeEnd?: (endedEpisodeData: { 
    contentId: string, 
    seriesId?: string, 
    seasonNumber?: number, 
    episodeNumber?: number, 
    seriesName?: string, 
    poster?: string 
  }) => void;
  onMarkAsWatched?: (contentId: string) => void; 

  // New props for in-player "Next Episode" card
  nextEpisodeDataProp: NextEpisodeDataForPlayerState | null;
  onRequestPlayNextEpisode: (item: ContentItem) => void;
  onNextEpisodeDataConsumed: () => void;
}

const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) return "00:00";
  const totalSeconds = Math.floor(timeInSeconds);
  
  if (totalSeconds >= 3600) { // If 1 hour or more
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
};

const ActualVideoPlayer: React.FC<VideoPlayerProps> = ({ 
    src, poster, contentId, startTime, onEarlySave,
    itemType, seriesId, seasonNumber, episodeNumber, seriesNameProp, onEpisodeEnd, onMarkAsWatched,
    nextEpisodeDataProp, onRequestPlayNextEpisode, onNextEpisodeDataConsumed
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentErrorMessage, setCurrentErrorMessage] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<number | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [buffered, setBuffered] = useState(0);

  const [inPlayerNextEpisodeInfo, setInPlayerNextEpisodeInfo] = useState<{
    visible: boolean;
    countdown: number;
    data?: NextEpisodeDataForPlayerState;
  } | null>(null);
  const nextEpisodeCountdownIntervalRef = useRef<number | null>(null);

  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<number | null>(null);

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, time: '00:00' });


  const timeStorageKey = contentId ? `video-time-${contentId}` : `video-time-${encodeURIComponent(src)}`;
  const durationStorageKey = contentId ? `video-duration-${contentId}` : `video-duration-${encodeURIComponent(src)}`;
  const lastPlayedStorageKey = contentId ? `video-lastPlayed-${contentId}` : `video-lastPlayed-${encodeURIComponent(src)}`;
  const volumeStorageKey = 'video-volume';
  const mutedStorageKey = 'video-muted';
  const watchedMarkerKey = contentId ? `video-marked-watched-${contentId}` : null;


  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
      controlsTimerRef.current = window.setTimeout(() => {
        if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
           setShowControls(false);
        }
      }, 3000);
    }
  }, []);

  const handlePlayerMouseMove = useCallback(() => {
    if (!showControls) {
      setShowControls(true);
    }
    resetControlsTimeout();
  }, [showControls, resetControlsTimeout]);

  const handlePlayerMouseLeave = useCallback(() => {
    // Let timeout handle hiding if playing
  }, []);
  
  const handleControlsFocus = useCallback(() => {
    setShowControls(true);
    resetControlsTimeout();
  }, [resetControlsTimeout]);


  useEffect(() => {
    const savedVolume = localStorage.getItem(volumeStorageKey);
    const savedMuted = localStorage.getItem(mutedStorageKey);
    if (savedVolume) setVolume(parseFloat(savedVolume));
    if (savedMuted) setIsMuted(savedMuted === 'true');
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    setInPlayerNextEpisodeInfo(null); 
    if (nextEpisodeCountdownIntervalRef.current) {
      clearInterval(nextEpisodeCountdownIntervalRef.current);
      nextEpisodeCountdownIntervalRef.current = null;
    }
    if (watchedMarkerKey) localStorage.removeItem(watchedMarkerKey); 
    
    const effectCleanup = () => {
        clearLoadingTimeout();
        if (videoElement && isFinite(videoElement.currentTime) && videoElement.duration > 0 && contentId && (videoElement.src === src || videoElement.currentSrc === src) ) {
            localStorage.setItem(timeStorageKey, videoElement.currentTime.toString());
            localStorage.setItem(durationStorageKey, videoElement.duration.toString());
            localStorage.setItem(lastPlayedStorageKey, Date.now().toString());
        }
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
        if (controlsTimerRef.current) {
            clearTimeout(controlsTimerRef.current);
        }
    };

    clearLoadingTimeout(); 
    setCurrentErrorMessage(null);
    setIsPlayerReady(false); 
    setIsPlaying(false);
    setBuffered(0);
    setShowControls(true);


    if (hlsRef.current) { 
        hlsRef.current.destroy();
        hlsRef.current = null;
    }
    
    if (!src) {
      if (videoElement.src) videoElement.src = ''; 
      setCurrentErrorMessage("No video source provided.");
      setIsPlayerReady(false); 
      return effectCleanup; 
    }
    
    loadingTimeoutRef.current = window.setTimeout(() => {
        if (!isPlayerReady && videoElement.networkState !== videoElement.NETWORK_NO_SOURCE && videoElement.networkState !== videoElement.NETWORK_EMPTY) { 
            setCurrentErrorMessage("Stream timed out or could not be loaded. Please check the source or your connection.");
            setIsPlayerReady(false);
        }
    }, 15000); 

    if ((src.endsWith('.m3u8') || src.endsWith('.ts')) && Hls.isSupported()) {
      const hls = new Hls({
          fragLoadingMaxRetry: 5, 
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 3,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoElement); 

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        clearLoadingTimeout();
        if (!currentErrorMessage) setIsPlayerReady(true);
      });
      
      hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
        if (isFinite(data.details.totalduration) && data.details.totalduration > 0) {
            setDuration(data.details.totalduration);
            if (contentId) localStorage.setItem(durationStorageKey, data.details.totalduration.toString());
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        clearLoadingTimeout();
        if (data.fatal || data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          let errorMsg = "An HLS error occurred.";
          if (data.details) errorMsg += ` Details: ${data.details}.`;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) errorMsg += ' Check network connection or CORS setup.';
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && data.details === 'bufferStalledError') errorMsg = 'Buffering stalled. Check connection or stream stability.';
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && data.details === 'fragParsingError') errorMsg = 'Error parsing video fragment. Stream might be corrupted.';
          else if (data.details === 'manifestLoadError' || data.details === 'manifestParsingError') errorMsg = 'Error loading or parsing the stream manifest (M3U8).';
          setCurrentErrorMessage(errorMsg);
          setIsPlayerReady(false); 
          if (hlsRef.current && data.fatal) { hlsRef.current.destroy(); hlsRef.current = null; }
        }
      });
    } else {
      if (videoElement.src !== src) videoElement.src = src;
    }
    return effectCleanup; 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, contentId]); 

  useEffect(() => {
    const video = videoRef.current;
    if (video && isPlayerReady && !currentErrorMessage) {
      let effectiveStartTime = 0;
      if (typeof startTime === 'number' && isFinite(startTime) && startTime >= 0) {
        effectiveStartTime = startTime;
      } else if (contentId) {
        const savedTime = localStorage.getItem(timeStorageKey);
        if (savedTime) {
          const time = parseFloat(savedTime);
          if (isFinite(time) && time >= 0) effectiveStartTime = time;
        }
      }
      if (video.duration && isFinite(video.duration) && effectiveStartTime >= video.duration - 1) { 
          effectiveStartTime = Math.max(0, video.duration - 5); 
          if (effectiveStartTime < 0) effectiveStartTime = 0;
      }
      if (isFinite(effectiveStartTime) && effectiveStartTime > 0 && Math.abs(video.currentTime - effectiveStartTime) > 0.5) { 
        video.currentTime = effectiveStartTime;
      }
      video.volume = volume;
      video.muted = isMuted;
      video.play().then(() => setIsPlaying(true))
      .catch(err => {
        setIsPlaying(false); 
        if (!currentErrorMessage) setCurrentErrorMessage(`Playback was prevented. You might need to click play. (${err.name})`);
      });
    } else if (currentErrorMessage && isPlayerReady) { 
        setIsPlayerReady(false); 
        setIsPlaying(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayerReady, currentErrorMessage, startTime, contentId, volume, isMuted, src]);


  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdateEv = () => {
      if (!video || !contentId) return;
      setCurrentTime(video.currentTime);
      const hasBeenSavedOnceKey = `video-saved-once-${contentId}`;
      const initialSaveThreshold = 1; 
      const playedPercentageThreshold = 5; 

      if (isFinite(video.duration) && video.duration > 0) {
        const progressPercent = (video.currentTime / video.duration) * 100;
        if ( isPlaying && (video.currentTime >= initialSaveThreshold || progressPercent >= playedPercentageThreshold) && video.currentTime < video.duration * 0.98 && !localStorage.getItem(hasBeenSavedOnceKey) ) {
            localStorage.setItem(timeStorageKey, video.currentTime.toString());
            localStorage.setItem(durationStorageKey, video.duration.toString());
            localStorage.setItem(lastPlayedStorageKey, Date.now().toString());
            localStorage.setItem(hasBeenSavedOnceKey, 'true');
            if (onEarlySave) onEarlySave();
        }
        if (onMarkAsWatched && contentId && itemType !== 'channel' && progressPercent >= 98 && !localStorage.getItem(watchedMarkerKey || `__never_match_this_key__`)) {
            onMarkAsWatched(contentId);
            if(watchedMarkerKey) localStorage.setItem(watchedMarkerKey, 'true');
        }
      }
    };
    const handleLoadedMetadataEv = () => {
        clearLoadingTimeout();
        if (!currentErrorMessage) { 
            if (!hlsRef.current) setIsPlayerReady(true); 
            setDuration(video.duration);
            if (isFinite(video.duration) && video.duration > 0 && contentId) localStorage.setItem(durationStorageKey, video.duration.toString());
        }
    };
    const handleCanPlayEv = () => {
        clearLoadingTimeout();
        if (!currentErrorMessage && !isPlayerReady) setIsPlayerReady(true); 
    };
    const handleErrorEv = (e: Event) => {
        clearLoadingTimeout();
        const videoError = (e.target as HTMLVideoElement).error;
        let msg = "A video error occurred.";
        if(videoError) {
            switch (videoError.code) {
                case MediaError.MEDIA_ERR_ABORTED: msg = "Video playback aborted."; break;
                case MediaError.MEDIA_ERR_NETWORK: msg = "A network error caused video download to fail."; break;
                case MediaError.MEDIA_ERR_DECODE: msg = "Video playback aborted due to a corruption problem or because the video used features your browser did not support."; break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = "The video could not be loaded, either because the server or network failed or because the format is not supported."; break;
                default: msg = "An unknown video error occurred.";
            }
            msg += ` (Code: ${videoError.code})`;
        }
        setCurrentErrorMessage(msg);
        setIsPlayerReady(false); 
    };
    const handleProgressEv = () => { if (video.buffered.length > 0 && isFinite(video.duration) && video.duration > 0) setBuffered(video.buffered.end(video.buffered.length - 1)); };
    video.addEventListener('loadedmetadata', handleLoadedMetadataEv);
    video.addEventListener('canplay', handleCanPlayEv); 
    video.addEventListener('timeupdate', handleTimeUpdateEv);
    video.addEventListener('error', handleErrorEv);
    video.addEventListener('progress', handleProgressEv);
    if (video.readyState >= video.HAVE_METADATA && !hlsRef.current && !currentErrorMessage && !isPlayerReady) {
        clearLoadingTimeout();
        setIsPlayerReady(true);
        setDuration(video.duration);
        if (isFinite(video.duration) && video.duration > 0 && contentId) localStorage.setItem(durationStorageKey, video.duration.toString());
    }
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadataEv);
      video.removeEventListener('canplay', handleCanPlayEv);
      video.removeEventListener('timeupdate', handleTimeUpdateEv);
      video.removeEventListener('error', handleErrorEv);
      video.removeEventListener('progress', handleProgressEv);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, currentErrorMessage, contentId, isPlaying, onEarlySave, onMarkAsWatched, itemType, watchedMarkerKey]); 

  useEffect(() => {
    if (nextEpisodeDataProp && nextEpisodeDataProp.nextEpisode) {
      setInPlayerNextEpisodeInfo({
        visible: true,
        countdown: 5,
        data: nextEpisodeDataProp,
      });
      onNextEpisodeDataConsumed(); 
    }
  }, [nextEpisodeDataProp, onNextEpisodeDataConsumed]);

  useEffect(() => {
    if (inPlayerNextEpisodeInfo?.visible && inPlayerNextEpisodeInfo.countdown > 0) {
      nextEpisodeCountdownIntervalRef.current = window.setInterval(() => {
        setInPlayerNextEpisodeInfo(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
      }, 1000);
    } else if (inPlayerNextEpisodeInfo?.visible && inPlayerNextEpisodeInfo.countdown === 0 && inPlayerNextEpisodeInfo.data?.nextEpisode) {
      if (nextEpisodeCountdownIntervalRef.current) clearInterval(nextEpisodeCountdownIntervalRef.current);
      onRequestPlayNextEpisode(inPlayerNextEpisodeInfo.data.nextEpisode);
      setInPlayerNextEpisodeInfo(null); 
    }
    return () => {
      if (nextEpisodeCountdownIntervalRef.current) clearInterval(nextEpisodeCountdownIntervalRef.current);
    };
  }, [inPlayerNextEpisodeInfo, onRequestPlayNextEpisode]);


  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handlePlayEvent = () => {
        setIsPlaying(true);
        setShowControls(true); 
        resetControlsTimeout();
    };
    const handlePauseEvent = () => {
      setIsPlaying(false);
      if (isFinite(video.currentTime) && video.duration > 0 && contentId) {
        localStorage.setItem(timeStorageKey, video.currentTime.toString());
        localStorage.setItem(lastPlayedStorageKey, Date.now().toString());
      }
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      setShowControls(true);
    };
    const handleEndedEvent = () => { 
      setIsPlaying(false);
      if (contentId && isFinite(video.duration) && video.duration > 0) {
         localStorage.setItem(timeStorageKey, video.duration.toString()); 
         localStorage.setItem(lastPlayedStorageKey, Date.now().toString());
         if (onMarkAsWatched && itemType !== 'channel' && !localStorage.getItem(watchedMarkerKey || `__never_match_this_key__`)) {
             onMarkAsWatched(contentId);
             if (watchedMarkerKey) localStorage.setItem(watchedMarkerKey, 'true');
         }
      }
      if (itemType === 'episode' && onEpisodeEnd && contentId) {
        onEpisodeEnd({
            contentId, seriesId, seasonNumber, episodeNumber, seriesName: seriesNameProp, poster,
        });
      }
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      setShowControls(true); 
    };
    const onVolumeChange = () => {
      setVolume(video.volume); setIsMuted(video.muted);
      localStorage.setItem(volumeStorageKey, video.volume.toString());
      localStorage.setItem(mutedStorageKey, video.muted.toString());
    };

    video.addEventListener('play', handlePlayEvent); 
    video.addEventListener('playing', handlePlayEvent);
    video.addEventListener('pause', handlePauseEvent);
    video.addEventListener('ended', handleEndedEvent); 
    video.addEventListener('volumechange', onVolumeChange);
    
    if (isPlayerReady && !currentErrorMessage) {
        if (!video.paused && !video.ended) {
            handlePlayEvent();
        } else {
            handlePauseEvent();
        }
    }

    return () => {
      video.removeEventListener('play', handlePlayEvent); 
      video.removeEventListener('playing', handlePlayEvent);
      video.removeEventListener('pause', handlePauseEvent);
      video.removeEventListener('ended', handleEndedEvent); 
      video.removeEventListener('volumechange', onVolumeChange);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayerReady, currentErrorMessage, contentId, itemType, seriesId, seasonNumber, episodeNumber, seriesNameProp, poster, onEpisodeEnd, onMarkAsWatched, resetControlsTimeout, watchedMarkerKey]);

  useEffect(() => {
    const videoElementContainer = playerContainerRef.current; 
    if (!videoElementContainer) return;
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);
  
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleEnterPiP = () => setIsPiPActive(true);
    const handleLeavePiP = () => setIsPiPActive(false);
    video.addEventListener('enterpictureinpicture', handleEnterPiP);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);
    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPiP);
      video.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isPlayerReady || currentErrorMessage) return;
    if (video.paused || video.ended) video.play().catch(err => setCurrentErrorMessage(`Could not play video: ${err.message}`));
    else video.pause();
  }, [isPlayerReady, currentErrorMessage]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!videoRef.current || !isPlayerReady || currentErrorMessage) return;
      const activeElement = document.activeElement;
      const isInputFocused = activeElement instanceof HTMLElement && 
                             (activeElement.tagName === 'INPUT' || 
                              activeElement.tagName === 'TEXTAREA' || 
                              activeElement.isContentEditable);
      
      if (isInputFocused && e.key !== 'Escape') return; 

      setShowControls(true);
      resetControlsTimeout();
      
      if (inPlayerNextEpisodeInfo?.visible && (e.key === 'Enter' || e.key === 'Escape')) {
        // Defer to card buttons or browser default for Esc (fullscreen)
      } else {
        e.preventDefault(); e.stopPropagation();
      }

      switch (e.key) {
        case ' ': case 'k': togglePlay(); break;
        case 'ArrowLeft': handleSeek(-10); break;
        case 'ArrowRight': handleSeek(10); break;
        case 'ArrowUp': videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1); break;
        case 'ArrowDown': videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1); break;
        case 'm': videoRef.current.muted = !videoRef.current.muted; break;
        case 'f': toggleFullScreen(e as unknown as React.MouseEvent); break;
        case 'p': togglePiP(e as unknown as React.MouseEvent); break;
        case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
          if(duration > 0) videoRef.current.currentTime = (duration / 10) * parseInt(e.key);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isPlayerReady, currentErrorMessage, togglePlay, duration, inPlayerNextEpisodeInfo, resetControlsTimeout]); 

  const handleSeek = (offset: number, event?: React.MouseEvent) => {
    event?.stopPropagation(); 
    const video = videoRef.current;
    if (video && isPlayerReady && !currentErrorMessage) video.currentTime = Math.max(0, Math.min(duration || Infinity, video.currentTime + offset));
  };
  
  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const video = videoRef.current;
    const progressElement = progressRef.current;
    if (!video || !progressElement || !isPlayerReady || currentErrorMessage || !isFinite(duration) || duration <= 0) return;

    const rect = progressElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));
    const newTime = percentage * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressHover = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const progressElement = progressRef.current;
    if (!progressElement || !isPlayerReady || currentErrorMessage || !isFinite(duration) || duration <= 0) return;
    
    const rect = progressElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));
    const hoverTime = percentage * duration;

    setTooltipPosition({ x: event.clientX - rect.left, time: formatTime(hoverTime) });
    setTooltipVisible(true);
  };

  const handleProgressLeave = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setTooltipVisible(false);
  };

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (video) {
      const newVolume = parseFloat(event.target.value);
      video.volume = newVolume;
      video.muted = newVolume === 0;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
      localStorage.setItem(volumeStorageKey, newVolume.toString());
      localStorage.setItem(mutedStorageKey, (newVolume === 0).toString());
    }
  };

  const toggleMute = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
      localStorage.setItem(mutedStorageKey, video.muted.toString());
      if (!video.muted && video.volume === 0) { // Unmuting and volume is 0, set to a default
        video.volume = 0.5;
        setVolume(0.5);
        localStorage.setItem(volumeStorageKey, '0.5');
      }
    }
  };

  const toggleFullScreen = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const container = playerContainerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => console.error("Error attempting to enable full-screen mode:", err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const togglePiP = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const video = videoRef.current;
    if (!video || !video.getVideoPlaybackQuality || !document.pictureInPictureEnabled) return; // Basic check for PiP support
    
    if (document.pictureInPictureElement === video) {
        document.exitPictureInPicture().catch(err => console.error("Error exiting PiP:", err));
    } else {
        video.requestPictureInPicture().catch(err => console.error("Error entering PiP:", err));
    }
  };

  const handleSkipNextEpisodeCard = (event: React.MouseEvent) => {
      event.stopPropagation();
      if (nextEpisodeCountdownIntervalRef.current) clearInterval(nextEpisodeCountdownIntervalRef.current);
      setInPlayerNextEpisodeInfo(null);
  };

  const handlePlayNextEpisodeFromCard = (event: React.MouseEvent) => {
      event.stopPropagation();
      if (nextEpisodeCountdownIntervalRef.current) clearInterval(nextEpisodeCountdownIntervalRef.current);
      if (inPlayerNextEpisodeInfo?.data?.nextEpisode) {
        onRequestPlayNextEpisode(inPlayerNextEpisodeInfo.data.nextEpisode);
      }
      setInPlayerNextEpisodeInfo(null);
  };


  const playerWrapperClass = `relative w-full h-full bg-black flex items-center justify-center 
                            ${(isPlayerReady && !currentErrorMessage) ? 'cursor-pointer' : 'cursor-default'}`;
  const controlsClass = `absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 transition-opacity duration-300 ease-in-out
                         ${(showControls && isPlayerReady && !currentErrorMessage && !inPlayerNextEpisodeInfo?.visible) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`;

  return (
    <div 
      ref={playerContainerRef} 
      className={playerWrapperClass}
      onClick={togglePlay}
      onMouseMove={handlePlayerMouseMove}
      onMouseLeave={handlePlayerMouseLeave}
      onFocusCapture={handleControlsFocus} 
      role="application"
      aria-roledescription="video player"
    >
      <video 
        ref={videoRef} 
        className="max-w-full max-h-full object-contain"
        poster={poster}
        playsInline 
        webkit-playsinline="true"
        aria-label="Video content"
      />
      
      {!isPlayerReady && !currentErrorMessage && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none" aria-label="Loading video">
          <div className="w-12 h-12 border-4 border-sv-text-secondary border-t-sv-accent-cyan rounded-full animate-spin"></div>
        </div>
      )}

      {currentErrorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/90 p-4 text-center text-sv-danger pointer-events-auto" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-lg font-semibold mb-2">Playback Error</p>
          <p className="text-sm">{currentErrorMessage}</p>
        </div>
      )}

      {inPlayerNextEpisodeInfo?.visible && inPlayerNextEpisodeInfo.data && (
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 p-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()} 
        >
          <div className="bg-sv-glass-card backdrop-blur-md border border-sv-border-glass rounded-xl shadow-2xl p-6 w-full max-w-md text-center">
            <p className="text-sm text-sv-text-secondary mb-1">Next Episode in {inPlayerNextEpisodeInfo.countdown}s...</p>
            <h3 className="text-lg font-bold text-sv-text-primary mb-2 truncate" title={inPlayerNextEpisodeInfo.data.nextEpisode.name}>
                {inPlayerNextEpisodeInfo.data.nextEpisode.name}
            </h3>
            {inPlayerNextEpisodeInfo.data.nextEpisode.poster ? (
                <img 
                    src={inPlayerNextEpisodeInfo.data.nextEpisode.poster} 
                    alt={inPlayerNextEpisodeInfo.data.nextEpisode.name}
                    className="w-full aspect-video object-cover rounded-md mb-4 shadow-md"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                />
            ) : (
                <div className="w-full aspect-video bg-sv-bg-deep rounded-md mb-4 shadow-md flex items-center justify-center">
                     {inPlayerNextEpisodeInfo.data.nextEpisode.type === 'movie' ? <FilmIcon className="w-16 h-16 text-sv-text-secondary" /> : <TvIcon className="w-16 h-16 text-sv-text-secondary" />}
                </div>
            )}
            <div className="flex justify-center gap-3">
              <button 
                onClick={handleSkipNextEpisodeCard}
                className="px-5 py-2 bg-sv-glass-search backdrop-blur-sm border border-sv-border-glass text-sv-text-primary rounded-lg hover:bg-opacity-80 transition-colors font-medium text-sm"
                aria-label="Cancel playing next episode"
              >
                Cancel
              </button>
              <button 
                onClick={handlePlayNextEpisodeFromCard}
                className="px-5 py-2 bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm shadow-lg"
                aria-label="Play next episode now"
              >
                Play Now
              </button>
            </div>
          </div>
        </div>
      )}


      <div 
        className={controlsClass} 
        onClick={(e) => e.stopPropagation()} 
        onFocusCapture={handleControlsFocus}
      >
        <div className="relative mb-2 group" 
            onMouseMove={handleProgressHover} 
            onMouseLeave={handleProgressLeave}
            onClick={handleProgressClick}
        >
          <div 
            ref={progressRef}
            className="h-1.5 bg-sv-text-secondary/30 rounded-full cursor-pointer group-hover:h-2.5 transition-all duration-150"
            role="slider"
            aria-label="Video progress"
            aria-valuenow={currentTime}
            aria-valuemin={0}
            aria-valuemax={duration}
            tabIndex={0}
            onKeyDown={(e) => { 
              if (e.key === 'ArrowLeft') { e.preventDefault(); handleSeek(-5); }
              else if (e.key === 'ArrowRight') { e.preventDefault(); handleSeek(5); }
            }}
          >
            <div 
              className="absolute top-0 left-0 h-full bg-sv-text-secondary/50 rounded-full" 
              style={{ width: `${(buffered / (duration || 1)) * 100}%` }}
              aria-hidden="true"
            ></div>
            <div 
              className="absolute top-0 left-0 h-full bg-sv-accent-cyan rounded-full" 
              style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              aria-hidden="true"
            >
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-sv-accent-cyan rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-150" aria-hidden="true"></div>
            </div>
          </div>
          {tooltipVisible && (
             <div 
                className="absolute bottom-full mb-2 transform -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded shadow-lg pointer-events-none" 
                style={{ left: `${tooltipPosition.x}px` }}
                aria-hidden="true"
             >
                {tooltipPosition.time}
             </div>
          )}
        </div>

        <div className="flex justify-between items-center text-sv-text-primary">
          <div className="flex items-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); handleSeek(-10); }} className="p-1.5 hover:bg-sv-hover-bg rounded-full transition-colors" aria-label="Rewind 10 seconds">
              <RewindIcon className="w-5 h-5" />
            </button>
            <button onClick={togglePlay} className="p-1.5 hover:bg-sv-hover-bg rounded-full transition-colors" aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 011-1h1a1 1 0 110 2H8a1 1 0 01-1-1zm5 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
              )}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleSeek(10); }} className="p-1.5 hover:bg-sv-hover-bg rounded-full transition-colors" aria-label="Fast forward 10 seconds">
              <FastForwardIcon className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5 ml-2">
              <button onClick={toggleMute} className="p-1.5 hover:bg-sv-hover-bg rounded-full transition-colors" aria-label={isMuted ? "Unmute" : "Mute"}>
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.728 1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                )}
              </button>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={handleVolumeChange}
                className="w-20 h-1.5 bg-sv-text-secondary/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sv-accent-cyan [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-sv-accent-cyan [&::-moz-range-thumb]:border-none"
                aria-label="Volume"
                onClick={(e) => e.stopPropagation()} 
              />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="flex items-center gap-2">
            {document.pictureInPictureEnabled && (
                <button onClick={togglePiP} className="p-1.5 hover:bg-sv-hover-bg rounded-full transition-colors" aria-label={isPiPActive ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture"}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M12.5 8.5h-5v3h5v-3z"/><path d="M18 3H2a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V5a2 2 0 00-2-2zm-1 11a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1h12a1 1 0 011 1v8z"/></svg>
                </button>
            )}
            <button onClick={toggleFullScreen} className="p-1.5 hover:bg-sv-hover-bg rounded-full transition-colors" aria-label={isFullScreen ? "Exit full screen" : "Enter full screen"}>
              {isFullScreen ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.5 14.5A.5.5 0 015 14V11H2.5a.5.5 0 010-1H5V7.5A.5.5 0 015.5 7H9V5.5a.5.5 0 011 0V9h3.5a.5.5 0 010 1H10v2.5a.5.5 0 01-.5.5H6V14a.5.5 0 01-.5.5zM14.5 5.5a.5.5 0 01.5-.5H18v2.5a.5.5 0 01-1 0V5h-2.5a.5.5 0 01-.5-.5z" clipRule="evenodd"/></svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 9.5a.5.5 0 01.5-.5H6V6.5A.5.5 0 016.5 6H10V3.5a.5.5 0 011 0V7h3.5a.5.5 0 010 1H11v2.5a.5.5 0 01-.5.5H7V13a.5.5 0 01-1 0V9.5zM16.5 14.5a.5.5 0 01-.5.5H14v-2.5a.5.5 0 011 0V14h2.5a.5.5 0 01.5.5z" clipRule="evenodd"/></svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ActualVideoPlayer);
