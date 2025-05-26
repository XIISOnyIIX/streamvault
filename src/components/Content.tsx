
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'; 
import { ContentItem, Playlist, Page, SeasonInfo, EpisodeInfo, ContentItem as ContentItemType, NextEpisodeDataForPlayerState, AppSettings, Profile, PageViewProps as GlobalPageViewProps } from '../types'; // Updated import
import { TvIcon, FilmIcon, LinkIcon, QuestionMarkCircleIcon, ChevronDownIcon, ChevronUpIcon, RefreshIcon, ChevronLeftIcon, ChevronRightIcon, ListBulletIcon, StarIcon, SpinnerIcon, CheckIcon } from './common/Icons'; // Added CheckIcon
import ActualVideoPlayer from './VideoPlayer'; 
import { SERIES_PLACEHOLDER_URL_PREFIX } from '../services/iptvService';
import { LAUNCH_SECTIONS, AUTO_REFRESH_OPTIONS } from '../constants';


export const INITIAL_ITEMS_TO_SHOW_GENERIC_CONTENT = 24;
const CONTINUE_WATCHING_HOME_LIMIT = 8;

const REASONABLE_MAX_LOAD_ALL_THRESHOLD = 300; 
const INCREMENTAL_LOAD_COUNT = 300; 

interface ContentCardProps {
  item: ContentItem;
  onPlay: (item: ContentItem) => void;
  watchedProgress?: number; 
  showRemoveButton?: boolean;
  onRemoveFromContinueWatching?: (item: ContentItem) => void; 
  isCompact?: boolean; 
  onViewSeriesDetail?: (seriesData: { seriesId: string, seriesName: string, poster?: string }) => void;
  showRateButton?: boolean; 
  onRate?: (item: ContentItem) => void; 
  showRemoveFromHistoryButton?: boolean; 
  onRemoveFromHistory?: (item: ContentItem) => void; 
}

const MemoizedContentCard: React.FC<ContentCardProps> = ({ 
    item, onPlay, watchedProgress, 
    showRemoveButton, onRemoveFromContinueWatching, 
    isCompact, onViewSeriesDetail,
    showRateButton, onRate,
    showRemoveFromHistoryButton, onRemoveFromHistory
}) => {
  
  let displayName = item.name;
  let displaySubtitle = "";

  if (item.type === 'episode' && item.seriesName) {
    displayName = item.seriesName;
    displaySubtitle = `S${String(item.seasonNumber).padStart(2,'0')}E${String(item.episodeNumber).padStart(2,'0')}${item.episodeTitle ? ` - ${item.episodeTitle}` : ''}`;
  } else if (item.type === 'movie' && item.year) {
    displaySubtitle = item.year;
  } else if (item.type === 'series' && item.episode) { 
    displaySubtitle = item.episode || (item.totalSeasons ? `${item.totalSeasons} Seasons` : '');
  } else if (item.type === 'channel') {
    displaySubtitle = item.group || 'Live Channel';
  }

  const fullSubtitleText = useMemo(() => {
    let parts = [];
    if (displaySubtitle) parts.push(displaySubtitle);
    if (item.rating) parts.push(`IMDb ${item.rating}`);
    if (item.userRating) parts.push(`⭐ ${item.userRating}/10`);
    
    let result = parts.join(' • ');

    if (!result) { 
        result = item.group || (item.type && item.type.charAt(0).toUpperCase() + item.type.slice(1)) || '';
    }
    return result;
  }, [displaySubtitle, item.rating, item.userRating, item.group, item.type]);


  return (
    <div 
      className={`bg-sv-glass-card backdrop-blur-md border border-sv-border-glass rounded-2xl shadow-lg transition-all duration-300 ease-in-out group hover:shadow-glow-cyan-card-hover hover:border-sv-border-glass-hover hover:-translate-y-1.5 ${isCompact ? 'w-52 flex-shrink-0' : ''}`}
      role="button" 
      tabIndex={0}
      onClick={() => onPlay(item)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPlay(item);}}
      aria-label={`Play ${displayName}${fullSubtitleText ? ' - ' + fullSubtitleText : ''}`}
    >
      <div className="aspect-video bg-black/20 rounded-t-2xl overflow-hidden relative">
        {item.poster ? (
          <img 
            src={item.poster} 
            alt={displayName} 
            className="w-full h-full object-cover" 
            loading="lazy"
            onError={(e) => (e.currentTarget.src = `https://picsum.photos/seed/${item.id}/300/168`)} 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sv-text-secondary/70">
            {item.type === 'channel' && <TvIcon className="w-12 h-12" />}
            {(item.type === 'movie' || item.originalType === 'movie') && <FilmIcon className="w-12 h-12" />}
            {(item.type === 'series' || item.type === 'episode' || item.originalType === 'episode') && <TvIcon className="w-12 h-12" />} 
          </div>
        )}
        {watchedProgress && watchedProgress > 1 && watchedProgress < 98 && ( 
          <div className="absolute bottom-0 left-0 h-1.5 bg-sv-accent-cyan rounded-tr-md" style={{ width: `${watchedProgress}%` }} aria-label={`Progress: ${watchedProgress.toFixed(0)}%`}></div>
        )}
        
        {item.displayStatus && item.type !== 'channel' && (
          <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold z-10
            ${item.displayStatus === 'watched' ? 'bg-sv-success text-sv-bg-deep' : 'bg-sv-warning text-sv-bg-deep'}`}>
            {item.displayStatus.toUpperCase()}
          </div>
        )}

         {item.type === 'channel' && (
          <div className="absolute top-2 right-2 bg-red-600/90 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">LIVE</div>
        )}
        <div className="absolute top-1.5 right-1.5 flex space-x-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {showRemoveButton && onRemoveFromContinueWatching && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFromContinueWatching(item); }}
                    className="p-1.5 bg-black/70 hover:bg-sv-danger text-white rounded-full transition-colors"
                    aria-label={`Remove ${displayName} from continue watching`}
                    title="Remove from Continue Watching"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
             {showRemoveFromHistoryButton && onRemoveFromHistory && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemoveFromHistory(item); }}
                    className="p-1.5 bg-black/70 hover:bg-sv-danger text-white rounded-full transition-colors"
                    aria-label={`Remove ${displayName} from watched history`}
                    title="Remove from Watched History"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
            {item.type === 'episode' && item.seriesId && item.seriesName && onViewSeriesDetail && (
                 <button
                    onClick={(e) => { e.stopPropagation(); onViewSeriesDetail({ seriesId: item.seriesId!, seriesName: item.seriesName!, poster: item.poster }); }}
                    className="p-1.5 bg-black/70 hover:bg-sv-accent-purple text-white rounded-full transition-colors"
                    aria-label={`View series details for ${item.seriesName}`}
                    title="View Series Details"
                >
                    <ListBulletIcon className="w-3.5 h-3.5" />
                </button>
            )}
            {showRateButton && onRate && (item.type === 'movie' || item.type === 'episode' || item.type === 'series') && (
                 <button
                    onClick={(e) => { e.stopPropagation(); onRate(item); }}
                    className="p-1.5 bg-black/70 hover:bg-sv-accent-purple text-white rounded-full transition-colors"
                    aria-label={`Rate ${displayName}`}
                    title="Rate this content"
                >
                    <StarIcon className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-sv-text-primary truncate group-hover:text-sv-accent-cyan transition-colors text-base" title={displayName}>{displayName}</h3>
        <p className="text-xs text-sv-text-secondary truncate" title={fullSubtitleText}>
          {displaySubtitle}
          {item.rating && (
            <>
              {(displaySubtitle) ? ' • ' : ''}IMDb {item.rating}
            </>
          )}
          {item.userRating && (
            <>
              {(displaySubtitle || item.rating) ? ' • ' : ''}
              <StarIcon className="w-3 h-3 mr-0.5 text-sv-warning inline-block relative -top-px" isFilled={true} /> {item.userRating}/10
            </>
          )}
          {!displaySubtitle && !item.rating && !item.userRating && (
            item.group || (item.type && item.type.charAt(0).toUpperCase() + item.type.slice(1))
          )}
        </p>
      </div>
    </div>
  );
};
export const ContentCard = React.memo(MemoizedContentCard);


interface ContentGridProps {
  items: ContentItem[];
  onPlay: (item: ContentItem) => void;
  showRemoveButtonInGrid?: boolean; 
  onRemoveItemFromGrid?: (item: ContentItem) => void; 
  isCompact?: boolean; 
  onViewSeriesDetail?: (seriesData: { seriesId: string, seriesName: string, poster?: string }) => void;
  showRateButtonInGrid?: boolean; 
  onRateItemInGrid?: (item: ContentItem) => void; 
  showRemoveFromHistoryButtonInGrid?: boolean; 
  onRemoveItemFromHistoryGrid?: (item: ContentItem) => void; 
}

const MemoizedContentGrid: React.FC<ContentGridProps> = ({ 
    items, onPlay, 
    showRemoveButtonInGrid, onRemoveItemFromGrid, 
    isCompact, onViewSeriesDetail,
    showRateButtonInGrid, onRateItemInGrid,
    showRemoveFromHistoryButtonInGrid, onRemoveItemFromHistoryGrid
}) => {
  if (items.length === 0) {
    return null; 
  }
  
  const gridClasses = isCompact 
    ? "flex space-x-4 pb-2" 
    : "grid grid-cols-content-fill gap-5"; 

  return (
    <div className={gridClasses}>
      {items.map((item) => {
        let progress = item.progress; 
        if (progress === undefined && (item.type === 'movie' || item.type === 'episode')) {
            const savedTimeStr = localStorage.getItem(`video-time-${item.id}`);
            const savedDurationStr = localStorage.getItem(`video-duration-${item.id}`);
            if (savedTimeStr && savedDurationStr) {
                const savedTime = parseFloat(savedTimeStr);
                const savedDuration = parseFloat(savedDurationStr);
                if (isFinite(savedTime) && isFinite(savedDuration) && savedDuration > 0 && savedTime > 0) {
                    progress = Math.min(100, Math.max(0, (savedTime / savedDuration) * 100));
                }
            }
        }
        return (
            <ContentCard 
                key={item.id + '-' + item.name + '-' + (item.watchedOn || '') + '-' + (item.displayStatus || '') + '-' + (item.userRating || '')} 
                item={item} 
                onPlay={onPlay} 
                watchedProgress={progress}
                showRemoveButton={showRemoveButtonInGrid}
                onRemoveFromContinueWatching={onRemoveItemFromGrid}
                isCompact={isCompact}
                onViewSeriesDetail={onViewSeriesDetail}
                showRateButton={showRateButtonInGrid}
                onRate={onRateItemInGrid}
                showRemoveFromHistoryButton={showRemoveFromHistoryButtonInGrid}
                onRemoveFromHistory={onRemoveItemFromHistoryGrid}
            />
        );
      })}
    </div>
  );
};
export const ContentGrid = React.memo(MemoizedContentGrid);

interface VideoPlayerWrapperProps {
  url: string;
  title: string;
  poster?: string | null;
  contentId?: string | null;
  startTime?: number; 
  onClose: () => void;
  onEarlySave?: () => void; 
  onMarkAsWatched?: (contentId: string) => void; 
  
  itemType?: ContentItemType['type'];
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
    poster?: string,
    playlistName?: string; 
  }) => void;
  nextEpisodeDataProp: NextEpisodeDataForPlayerState | null;
  onRequestPlayNextEpisode: (item: ContentItem) => void;
  onNextEpisodeDataConsumed: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerWrapperProps> = ({ 
    url, title, poster, contentId, startTime, onClose, onEarlySave, onMarkAsWatched,
    itemType, seriesId, seasonNumber, episodeNumber, seriesNameProp, onEpisodeEnd,
    nextEpisodeDataProp, onRequestPlayNextEpisode, onNextEpisodeDataConsumed
}) => {
  return (
    <div className="p-6 flex flex-col h-full bg-sv-bg-deep"> 
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-sv-text-primary">{title}</h1>
        <button 
            onClick={onClose}
            className="px-6 py-2 bg-sv-accent-cyan text-sv-bg-deep font-semibold rounded-lg hover:bg-opacity-80 transition-colors"
            aria-label="Back to content"
            >
            Back
        </button>
      </div>
      <div className="flex-grow aspect-video bg-black rounded-xl overflow-hidden mb-0 shadow-2xl relative min-h-0"> 
        <ActualVideoPlayer 
            src={url} 
            poster={poster || undefined} 
            contentId={contentId || undefined} 
            startTime={startTime} 
            onEarlySave={onEarlySave}
            onMarkAsWatched={onMarkAsWatched}
            itemType={itemType}
            seriesId={seriesId}
            seasonNumber={seasonNumber}
            episodeNumber={episodeNumber}
            seriesNameProp={seriesNameProp}
            onEpisodeEnd={onEpisodeEnd}
            nextEpisodeDataProp={nextEpisodeDataProp}
            onRequestPlayNextEpisode={onRequestPlayNextEpisode}
            onNextEpisodeDataConsumed={onNextEpisodeDataConsumed}
        />
      </div>
    </div>
  );
};

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionButton?: { text: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, actionButton }) => (
  <div className="text-center py-16 px-5 text-sv-text-secondary">
    {icon && <div className="text-5xl mb-4 mx-auto w-fit opacity-50">{icon}</div>}
    <h2 className="text-lg font-semibold text-sv-text-primary mb-2">{title}</h2>
    <p className="text-sm leading-relaxed mb-4 whitespace-pre-line">{description}</p>
    {actionButton && (
      <button 
        onClick={actionButton.onClick}
        className="bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple text-white font-semibold px-6 py-2.5 rounded-full transition-transform hover:scale-105 shadow-lg hover:shadow-xl"
      >
        {actionButton.text}
      </button>
    )}
  </div>
);

interface ConnectionStatusProps {
  isConnected: boolean; 
}
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isConnected }) => (
    <div className="flex items-center gap-2 mb-1"> 
        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-sv-status-connected animate-pulse' : 'bg-sv-danger'}`} aria-hidden="true"></div>
        <span className={`text-xs ${isConnected ? 'text-sv-status-connected' : 'text-sv-danger'}`}>
            {isConnected ? 'Connected' : 'Not Connected'}
        </span>
    </div>
);


export const getConsolidatedContinueWatchingItems = (): ContentItem[] => {
    const allMetadataItems: ContentItem[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('video-metadata-')) {
            const itemId = key.substring('video-metadata-'.length);
            const metadataStr = localStorage.getItem(key);
            const savedTimeStr = localStorage.getItem(`video-time-${itemId}`);
            const savedDurationStr = localStorage.getItem(`video-duration-${itemId}`);
            const lastPlayedStr = localStorage.getItem(`video-lastPlayed-${itemId}`);

            if (metadataStr && savedTimeStr && savedDurationStr) {
                try {
                    const metadata = JSON.parse(metadataStr) as ContentItem;
                    const savedTime = parseFloat(savedTimeStr);
                    const savedDuration = parseFloat(savedDurationStr);
                    const lastPlayed = lastPlayedStr ? parseInt(lastPlayedStr, 10) : 0;

                    if (isFinite(savedTime) && isFinite(savedDuration) && savedDuration > 0 && savedTime > 0.5) {
                        const progress = Math.min(100, Math.max(0, (savedTime / savedDuration) * 100));
                        if (progress < 98) { 
                             allMetadataItems.push({ 
                                ...metadata, 
                                id: itemId, 
                                url: metadata.url || '', 
                                progress,
                                lastPlayed: isFinite(lastPlayed) ? lastPlayed : 0,
                                type: metadata.originalType === 'episode' ? 'episode' : (metadata.originalType === 'movie' ? 'movie' : metadata.type),
                                displayStatus: 'watching',
                                playlistName: metadata.playlistName, 
                            });
                        }
                    }
                } catch (e) {
                    console.error("Error parsing metadata from localStorage for item ID:", itemId, e);
                }
            }
        }
    }

    const episodesBySeries: Record<string, ContentItem[]> = {};
    const moviesAndChannels: ContentItem[] = [];

    allMetadataItems.forEach(item => {
        if (item.type === 'episode' && item.seriesId) {
            if (!episodesBySeries[item.seriesId]) {
                episodesBySeries[item.seriesId] = [];
            }
            episodesBySeries[item.seriesId].push(item);
        } else if (item.type === 'movie' || item.type === 'channel') { 
            moviesAndChannels.push(item);
        }
    });

    const consolidatedSeriesEpisodes: ContentItem[] = [];
    for (const seriesId in episodesBySeries) {
        const episodes = episodesBySeries[seriesId];
        episodes.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || 
                                (b.seasonNumber || 0) - (a.seasonNumber || 0) ||
                                (b.episodeNumber || 0) - (a.episodeNumber || 0));
        if (episodes.length > 0) {
            const latestEpisode = episodes[0];
            consolidatedSeriesEpisodes.push(latestEpisode);
        }
    }
    
    return [...consolidatedSeriesEpisodes, ...moviesAndChannels].sort((a,b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
};

export type PageViewProps = GlobalPageViewProps & { continueWatchingItems?: ContentItem[] };


type HomePageViewProps = Pick<PageViewProps, 'activeProfile' | 'playlists' | 'onAddPlaylist' | 'onPlayContent' | 'lastPlayedTimestamp' | 'onRemoveFromContinueWatching' | 'onNavigate' | 'onViewSeriesDetail' | 'continueWatchingItems' | 'isFirstPlaylistAdded'>; 

const MemoizedHomePageView: React.FC<HomePageViewProps> = ({ 
  activeProfile, playlists, onAddPlaylist, onPlayContent, 
  continueWatchingItems = [], onRemoveFromContinueWatching, 
  onNavigate, onViewSeriesDetail, isFirstPlaylistAdded 
}) => {
  
  const [scrollIndex, setScrollIndex] = useState(0);
  const cwScrollContainerRef = useRef<HTMLDivElement>(null);

  const itemsToShowInScroller = useMemo(() => {
    return continueWatchingItems.slice(scrollIndex, scrollIndex + CONTINUE_WATCHING_HOME_LIMIT);
  }, [continueWatchingItems, scrollIndex]);

  const handleScrollNext = () => {
    if (scrollIndex + CONTINUE_WATCHING_HOME_LIMIT < continueWatchingItems.length) {
        setScrollIndex(prev => prev + CONTINUE_WATCHING_HOME_LIMIT);
    }
  };

  const handleScrollPrev = () => {
     setScrollIndex(prev => Math.max(0, prev - CONTINUE_WATCHING_HOME_LIMIT));
  };

  const recentlyAddedItems: ContentItem[] = useMemo(() => playlists
    .flatMap(p => p.content)
    .filter(item => !(item.type === 'series' && item.url.startsWith(SERIES_PLACEHOLDER_URL_PREFIX) && !item.seasons?.length)) 
    .slice(-8).reverse(), 
    [playlists]); 

  let welcomeMessage = "Welcome!";
  if (isFirstPlaylistAdded && activeProfile) {
    welcomeMessage = `Welcome back, ${activeProfile.name}!`;
  }


  return (
    <div className="p-8"> 
      <div className="bg-sv-glass-welcome backdrop-blur-xl border border-sv-border-glass rounded-3xl p-8 mb-10 shadow-2xl">
        <h1 className="text-4xl font-bold text-sv-text-primary mb-2">{welcomeMessage}</h1>
        {isFirstPlaylistAdded && <ConnectionStatus isConnected={playlists.length > 0} />}
      </div>

      {!isFirstPlaylistAdded ? (
        <EmptyState 
          icon={<TvIcon className="w-12 h-12 opacity-50" />} 
          title="Start Your Streaming Journey" 
          description="Add a Playlist to Begin 🍿😎"
          actionButton={{ text: 'Add Playlist', onClick: onAddPlaylist }}
        />
      ) : (
        <>
          {continueWatchingItems.length > 0 && (
            <section className="mb-12" aria-labelledby="continue-watching-heading">
              <div className="flex justify-between items-center mb-5">
                <h2 id="continue-watching-heading" className="text-2xl font-semibold text-sv-text-primary">Continue Watching</h2>
                <button 
                    onClick={() => onNavigate(Page.ContinueWatchingAll)}
                    className="text-sm text-sv-accent-cyan hover:underline focus:outline-none focus:ring-2 focus:ring-sv-accent-purple rounded px-2 py-1"
                >
                    See All ({continueWatchingItems.length})
                </button>
              </div>
              <div className="relative">
                {scrollIndex > 0 && (
                     <button 
                        onClick={handleScrollPrev} 
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2.5 bg-black/60 hover:bg-sv-accent-cyan/80 rounded-full text-white transition-colors shadow-lg -ml-3"
                        aria-label="Previous continue watching items"
                    >
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                )}
                <div ref={cwScrollContainerRef} className="overflow-x-auto scrollbar-hide py-2 -mx-2 px-2"> 
                     <ContentGrid 
                        items={itemsToShowInScroller} 
                        onPlay={onPlayContent} 
                        showRemoveButtonInGrid={true} 
                        onRemoveItemFromGrid={onRemoveFromContinueWatching}
                        onViewSeriesDetail={onViewSeriesDetail}
                        isCompact={true} 
                    />
                </div>
                 {scrollIndex + CONTINUE_WATCHING_HOME_LIMIT < continueWatchingItems.length && (
                     <button 
                        onClick={handleScrollNext} 
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2.5 bg-black/60 hover:bg-sv-accent-cyan/80 rounded-full text-white transition-colors shadow-lg -mr-3"
                        aria-label="Next continue watching items"
                    >
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                )}
              </div>
            </section>
          )}
          {recentlyAddedItems.length > 0 && ( 
            <section className="mb-12" aria-labelledby="recently-added-heading">
              <div className="flex justify-between items-center mb-5">
                <h2 id="recently-added-heading" className="text-2xl font-semibold text-sv-text-primary">Recently Added / All Content</h2>
              </div>
              <ContentGrid items={recentlyAddedItems} onPlay={onPlayContent} />
            </section>
          )}
          {isFirstPlaylistAdded && continueWatchingItems.length === 0 && recentlyAddedItems.length === 0 && ( 
             <EmptyState 
              icon={<TvIcon className="w-12 h-12 opacity-50" />} 
              title="No Content Found" 
              description="Your connected playlists do not seem to have any watchable content under 'Continue Watching' or 'Recently Added' categories, or the content is not yet categorized."
            />
          )}
        </>
      )}
    </div>
  );
};
export const HomePageView = React.memo(MemoizedHomePageView);


type GenericPageContentViewProps = Pick<PageViewProps, 'filteredContent' | 'onPlayContent' | 'onAddPlaylist' | 'playlists' | 'displayLimit' | 'onSetDisplayLimit' | 'watchHistory'> & { title: string, type: ContentItem['type'] };

const MemoizedGenericPageContentView: React.FC<GenericPageContentViewProps> = ({ 
    filteredContent, onPlayContent, onAddPlaylist, playlists, title, type, displayLimit, onSetDisplayLimit, watchHistory
}) => {
  
  const [isButtonLoading, setIsButtonLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    return filteredContent
      .filter(item => item.type === type)
      .map(item => {
        if (item.type === 'movie' || item.type === 'series' || item.type === 'episode') { 
          let displayStatus: ContentItem['displayStatus'] = undefined;
          const isWatchedInHistory = watchHistory?.some(whItem => whItem.id === item.id || (item.type === 'episode' && whItem.id === item.seriesId));
          
          if (isWatchedInHistory) {
            displayStatus = 'watched';
          } else {
            const savedTimeStr = localStorage.getItem(`video-time-${item.id}`);
            const savedDurationStr = localStorage.getItem(`video-duration-${item.id}`);
            if (savedTimeStr && savedDurationStr) {
              const savedTime = parseFloat(savedTimeStr);
              const savedDuration = parseFloat(savedDurationStr);
              if (isFinite(savedTime) && isFinite(savedDuration) && savedDuration > 0) {
                const progressPercent = (savedTime / savedDuration) * 100;
                if (progressPercent >= 98) {
                  displayStatus = 'watched';
                } else if (savedTime > 5 || progressPercent > 1) { 
                  displayStatus = 'watching';
                }
              }
            }
          }
          const userRating = item.userRating || watchHistory?.find(whItem => whItem.id === item.id)?.userRating;
          return { ...item, displayStatus, userRating };
        }
        return item;
      });
  }, [filteredContent, type, watchHistory]);
  
  const itemsIdentity = useMemo(() => JSON.stringify(items.map(i => i.id + (i.userRating || '') + (i.displayStatus || ''))), [items]); 

  useEffect(() => {
    onSetDisplayLimit(INITIAL_ITEMS_TO_SHOW_GENERIC_CONTENT);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsIdentity, type]); 

  const itemsToShow = useMemo(() => items.slice(0, displayLimit), [items, displayLimit]);

  const loadMoreItems = useCallback(() => {
    if (displayLimit < items.length) {
      onSetDisplayLimit(Math.min(items.length, displayLimit + INCREMENTAL_LOAD_COUNT));
    }
  }, [displayLimit, items.length, onSetDisplayLimit]);

  const handleLoadMoreOrAllClick = () => {
    if (isButtonLoading) return;
    setIsButtonLoading(true);
    loadMoreItems();
    requestAnimationFrame(() => { 
      setIsButtonLoading(false);
    });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isButtonLoading && displayLimit < items.length) {
          loadMoreItems();
        }
      },
      { threshold: 1.0 } 
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [loadMoreItems, isButtonLoading, displayLimit, items.length]);


  const itemsLeft = items.length - displayLimit;
  let buttonText = `Load All Remaining (${itemsLeft})`;
  if (itemsLeft > 0) { 
    const itemsToLoadNext = Math.min(INCREMENTAL_LOAD_COUNT, itemsLeft);
    buttonText = `Load More (+${itemsToLoadNext})`;
    if (itemsToLoadNext === itemsLeft) {
        buttonText = `Load All Remaining (${itemsLeft})`;
    }
  }


  return (
     <div className="p-8">
      <h1 className="text-3xl font-bold mb-8 text-sv-text-primary">{title}</h1>
      {items.length === 0 ? (
         <EmptyState 
          icon={type === 'channel' ? <TvIcon className="w-12 h-12 opacity-50" /> : <FilmIcon className="w-12 h-12 opacity-50" />}
          title={`No ${title} available`}
          description={`No content of type '${title.toLowerCase()}' found in your current playlists or search results.`}
          actionButton={(playlists && playlists.length === 0) ? { text: 'Add Playlist', onClick: onAddPlaylist } : undefined}
        />
      ) : (
        <>
          <ContentGrid items={itemsToShow} onPlay={onPlayContent} />
          
          {items.length > displayLimit && (
            <div className="mt-10 text-center">
              <button
                onClick={handleLoadMoreOrAllClick}
                disabled={isButtonLoading}
                className="px-6 py-3 bg-sv-accent-cyan text-sv-bg-deep font-semibold rounded-lg hover:bg-opacity-80 transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center mx-auto min-w-[200px]"
              >
                {isButtonLoading ? (
                  <>
                    <SpinnerIcon className="w-5 h-5 mr-2" />
                    Loading...
                  </>
                ) : (
                  buttonText
                )}
              </button>
            </div>
          )}
          {displayLimit < items.length && (
            <div ref={sentinelRef} style={{ height: '1px', marginTop: '20px' }}></div>
          )}
        </>
      )}
    </div>
  );
};
const GenericPageContentView = React.memo(MemoizedGenericPageContentView);


type LiveTVPageViewProps = Pick<PageViewProps, 'filteredContent' | 'onPlayContent' | 'onAddPlaylist' | 'playlists' | 'displayLimit' | 'onSetDisplayLimit' | 'watchHistory'>;
const MemoizedLiveTVPageView: React.FC<LiveTVPageViewProps> = (props) => 
  <GenericPageContentView {...props} title="Live TV" type="channel" />;
export const LiveTVPageView = React.memo(MemoizedLiveTVPageView);

type MoviesPageViewProps = Pick<PageViewProps, 'filteredContent' | 'onPlayContent' | 'onAddPlaylist' | 'playlists' | 'displayLimit' | 'onSetDisplayLimit' | 'watchHistory'>;
const MemoizedMoviesPageView: React.FC<MoviesPageViewProps> = (props) => 
  <GenericPageContentView {...props} title="Movies" type="movie" />;
export const MoviesPageView = React.memo(MemoizedMoviesPageView);

type SeriesPageViewProps = Pick<PageViewProps, 'filteredContent' | 'onPlayContent' | 'onAddPlaylist' | 'playlists' | 'displayLimit' | 'onSetDisplayLimit' | 'watchHistory'>;
const MemoizedSeriesPageView: React.FC<SeriesPageViewProps> = (props) => 
  <GenericPageContentView {...props} title="Series" type="series" />;
export const SeriesPageView = React.memo(MemoizedSeriesPageView);

type PlaylistsPageViewProps = Pick<PageViewProps, 'playlists' | 'onAddPlaylist' | 'onRemovePlaylist' | 'onRefreshPlaylist'>;
const MemoizedPlaylistsPageView: React.FC<PlaylistsPageViewProps> = ({ playlists, onAddPlaylist, onRemovePlaylist, onRefreshPlaylist }) => {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-sv-text-primary">Playlists</h1>
        <button 
          onClick={onAddPlaylist}
          className="bg-gradient-to-r from-sv-accent-cyan to-sv-accent-purple text-white font-semibold px-6 py-2.5 rounded-lg transition-transform hover:scale-105 shadow-lg"
        >
          Add New Playlist
        </button>
      </div>
      {playlists.length === 0 ? (
        <EmptyState 
          icon={<LinkIcon className="w-12 h-12 opacity-50" />} 
          title="No playlists added yet" 
          description="Manage your IPTV sources here. Click 'Add New Playlist' to get started."
        />
      ) : (
        <div className="grid grid-cols-content-fill gap-5">
          {playlists.map(p => (
            <div key={p.name} className="bg-sv-glass-card backdrop-blur-md border border-sv-border-glass rounded-2xl overflow-hidden shadow-lg">
              <div className="aspect-4/3 bg-black/20 flex items-center justify-center text-sv-text-secondary text-lg font-semibold relative" 
                style={{ backgroundImage: `url(https://picsum.photos/seed/${encodeURIComponent(p.name)}/200/150)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                <span className="relative z-10 bg-black/60 px-4 py-1.5 rounded-md text-sm">{p.type.toUpperCase()} Source</span>
                 {(p.type === 'm3u' && p.url) || p.type === 'xtream' ? (
                    <button
                        onClick={() => onRefreshPlaylist(p.name)}
                        className="absolute top-2.5 right-2.5 p-2 bg-black/70 hover:bg-sv-accent-cyan/80 text-white rounded-full transition-colors z-10 shadow-md"
                        title="Refresh Playlist"
                        aria-label={`Refresh playlist ${p.name}`}
                    >
                        <RefreshIcon className="w-4 h-4" />
                    </button>
                ) : null}
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-sv-text-primary truncate mb-1.5 text-base">{p.name}</h3>
                <p className="text-xs text-sv-text-secondary mb-4">Content Count: {p.content?.length || 0}</p>
                <button 
                  onClick={() => onRemovePlaylist(p.name)}
                  className="w-full bg-sv-hover-bg text-sv-text-primary py-2.5 rounded-lg hover:bg-sv-danger hover:text-white transition-colors text-sm font-medium"
                  aria-label={`Remove playlist ${p.name}`}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export const PlaylistsPageView = React.memo(MemoizedPlaylistsPageView);


const SettingsSection: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
  <section className="bg-sv-glass-card backdrop-blur-md border border-sv-border-glass rounded-2xl shadow-lg">
    <div className="p-6 border-b border-sv-border-glass/50 flex items-center gap-3">
      <h2 className="text-xl font-semibold text-sv-text-primary">{title}</h2>
    </div>
    <div className="p-6 space-y-5">
      {children}
    </div>
  </section>
);

const SettingsItem: React.FC<{ label: string; children: React.ReactNode; description?: string }> = ({ label, children, description }) => (
  <div>
    <label className="block text-sm font-medium text-sv-text-primary mb-1.5">{label}</label>
    {children}
    {description && <p className="text-xs text-sv-text-secondary/80 mt-1.5">{description}</p>}
  </div>
);


const commonInputClass = "w-full bg-[#1A1E2C] border border-sv-border-glass rounded-lg p-2.5 text-sv-text-primary placeholder-sv-text-secondary/70 focus:border-sv-accent-cyan focus:ring-1 focus:ring-sv-accent-cyan outline-none text-sm transition-all duration-200";
const arrowSvgDefault = "data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%23A0A0B8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E";
const arrowSvgFocus = "data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2300F0FF%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E";
const selectClasses = `w-full bg-[#1A1E2C] border border-sv-border-glass rounded-lg py-2.5 pl-2.5 pr-10 text-sv-text-primary placeholder-sv-text-secondary/70 focus:border-sv-accent-cyan focus:ring-1 focus:ring-sv-accent-cyan outline-none text-sm transition-all duration-200 appearance-none bg-no-repeat bg-[position:right_12px_top_12px] bg-[length:16px_16px] bg-[url('${arrowSvgDefault}')] focus:bg-[url('${arrowSvgFocus}')]`;


type SettingsPageViewProps = Pick<PageViewProps, 'appSettings' | 'onAppSettingsChange' | 'onOpenEditProfileModal' | 'onClearCache' | 'cacheUsageMB' | 'onResetProfile' | 'showMessageBox' | 'onOpenFeedbackModal'>; 

const MemoizedSettingsPageView: React.FC<SettingsPageViewProps> = ({ 
  appSettings, onAppSettingsChange, onOpenEditProfileModal, 
  onClearCache, cacheUsageMB, onResetProfile, showMessageBox, onOpenFeedbackModal 
}) => {
  if (!appSettings || !onAppSettingsChange || !onOpenEditProfileModal || !onClearCache || cacheUsageMB === undefined || !onResetProfile || !showMessageBox || !onOpenFeedbackModal) { 
    return <div className="p-8"><SpinnerIcon className="w-8 h-8 text-sv-accent-cyan mx-auto" /></div>; 
  }
  
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-10 text-sv-text-primary">Settings</h1>
      
      <div className="space-y-8 max-w-2xl">
        <SettingsSection title="⚙️ General Settings">
          <SettingsItem label="Default Launch Section">
            <select 
              id="default-launch-section"
              value={appSettings.defaultLaunchSection}
              onChange={(e) => onAppSettingsChange('defaultLaunchSection', e.target.value as Page)}
              className={selectClasses}
              aria-label="Default Launch Section"
            >
              {LAUNCH_SECTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-[#1A1E2C] text-sv-text-primary">{opt.label}</option>
              ))}
            </select>
          </SettingsItem>
          <SettingsItem label="Auto Refresh Channels">
            <div className="flex space-x-6 mt-1" role="radiogroup" aria-labelledby="auto-refresh-label">
             <span id="auto-refresh-label" className="sr-only">Auto Refresh Channels Options</span>
              {AUTO_REFRESH_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center text-sm text-sv-text-primary cursor-pointer">
                  <input 
                    type="radio" 
                    name="autoRefreshChannels" 
                    value={opt.value}
                    checked={appSettings.autoRefreshChannels === opt.value}
                    onChange={() => onAppSettingsChange('autoRefreshChannels', opt.value)}
                    className="appearance-none peer" 
                  />
                  <span className="w-5 h-5 rounded-full border-2 border-sv-border-glass-hover mr-2 flex items-center justify-center transition-all peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-offset-sv-bg-deep peer-focus:ring-sv-accent-cyan">
                    <span className={`w-2.5 h-2.5 rounded-full bg-sv-accent-cyan transition-transform duration-150 ${appSettings.autoRefreshChannels === opt.value ? 'scale-100' : 'scale-0'}`}></span>
                  </span>
                  {opt.label}
                </label>
              ))}
            </div>
          </SettingsItem>
        </SettingsSection>

        <SettingsSection title="🔒 Storage">
           <SettingsItem label="Cache Usage">
             <div className="flex items-center justify-between">
                <p className="text-sv-text-secondary">Used: <span className="text-sv-text-primary font-medium">{cacheUsageMB}</span></p>
                <button 
                  onClick={onClearCache}
                  className="px-4 py-2 bg-sv-accent-cyan text-sv-bg-deep font-semibold rounded-lg hover:bg-opacity-80 transition-colors text-sm shadow-md"
                  aria-label="Clear application cache"
                >
                  Clear Cache
                </button>
             </div>
          </SettingsItem>
        </SettingsSection>

        <SettingsSection title="👤 Account / Profile">
          <SettingsItem label="Manage Your Profile">
            <div className="flex space-x-3">
              <button 
                  onClick={onOpenEditProfileModal}
                  className="px-5 py-2.5 bg-sv-accent-purple text-white font-semibold rounded-lg hover:bg-opacity-80 transition-colors text-sm shadow-md"
                  aria-label="Edit your profile details"
                >
                  Edit Profile
                </button>
                <button
                  onClick={onResetProfile}
                  className="px-5 py-2.5 bg-sv-warning text-sv-bg-deep font-semibold rounded-lg hover:bg-opacity-80 transition-colors text-sm shadow-md"
                  aria-label="Reset profile to default"
                >
                  Reset Profile
                </button>
            </div>
          </SettingsItem>
        </SettingsSection>

        <SettingsSection title="🔔 Notifications">
          <SettingsItem label="Application Updates">
             <label className="flex items-center text-sv-text-primary cursor-pointer mb-4">
                <input 
                  type="checkbox"
                  id="enable-update-notifications"
                  checked={appSettings.enableUpdateNotifications}
                  onChange={(e) => onAppSettingsChange('enableUpdateNotifications', e.target.checked)}
                  className="appearance-none peer"
                />
                <span className={`w-5 h-5 rounded-md border-2 border-sv-border-glass-hover mr-2.5 flex items-center justify-center transition-all duration-200 peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-offset-sv-bg-deep peer-focus:ring-sv-accent-cyan ${appSettings.enableUpdateNotifications ? 'bg-sv-accent-cyan/30' : 'bg-transparent'}`}>
                  {appSettings.enableUpdateNotifications && <CheckIcon className="w-3 h-3 text-sv-accent-cyan" />}
                </span>
                <span>Enable Update Notifications</span>
              </label>
              <button 
                onClick={() => {
                  if (window.electronAPI && typeof window.electronAPI.checkForUpdates === 'function') {
                    showMessageBox("Update Check", "Checking for updates... You will be notified if an update is found and downloaded.");
                    window.electronAPI.checkForUpdates();
                  } else {
                    showMessageBox("Error", "Update checking feature is not available.");
                  }
                }}
                className="px-4 py-2 bg-sv-accent-purple text-white font-semibold rounded-lg hover:bg-opacity-80 transition-colors text-sm shadow-md"
              >
                Check for Updates
              </button>
          </SettingsItem>
        </SettingsSection>
        
        <SettingsSection title="💬 Feedback">
           <SettingsItem label="Share Your Thoughts">
             <button 
                onClick={onOpenFeedbackModal} 
                className="px-4 py-2 bg-sv-accent-purple text-white font-semibold rounded-lg hover:bg-opacity-80 transition-colors text-sm shadow-md"
              >
                Send Feedback
              </button>
          </SettingsItem>
        </SettingsSection>

        <SettingsSection title="ℹ️ About">
          <div className="text-sm text-sv-text-secondary space-y-1.5">
            <p>StreamVault IPTV Player v1.0.6</p>
            <p>Developed with ❤️ by XIISOnyIIX</p>
            <p>© {new Date().getFullYear()} StreamVault. All Rights Reserved.</p>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
};
export const SettingsPageView = React.memo(MemoizedSettingsPageView);


interface SeriesDetailPageViewProps {
  seriesItem: ContentItem;
  seasons: SeasonInfo[];
  seriesPoster?: string;
  onPlayEpisode: (episodeItem: ContentItem) => void;
  onBack: () => void;
  isLoading: boolean;
}

const MemoizedSeriesDetailPageView: React.FC<SeriesDetailPageViewProps> = ({ seriesItem, seasons, seriesPoster, onPlayEpisode, onBack, isLoading }) => {
  const [openSeason, setOpenSeason] = useState<number | null>(null);

  useEffect(() => { 
    if (seasons.length > 0 && openSeason === null) {
      setOpenSeason(seasons[0].season_number);
    } else if (seasons.length === 0 && openSeason !== null) {
      setOpenSeason(null); 
    }
  }, [seasons, openSeason]);

  const toggleSeason = (seasonNumber: number) => {
    setOpenSeason(prev => prev === seasonNumber ? null : seasonNumber);
  };
  
  const handleEpisodePlay = useCallback((episode: EpisodeInfo) => {
    const episodeContentItem: ContentItem = {
        id: episode.id, 
        type: 'episode',
        name: `${seriesItem.name} - S${String(episode.season).padStart(2,'0')}E${String(episode.episode).padStart(2,'0')} - ${episode.title}`,
        url: episode.url || '', 
        poster: episode.poster || seriesPoster, 
        seriesId: seriesItem.seriesId,
        seasonNumber: episode.season,
        episodeNumber: episode.episode,
        episodeTitle: episode.title, 
        group: seriesItem.group, 
        seriesName: seriesItem.name, 
        originalType: 'episode',
        playlistName: seriesItem.playlistName, 
    };
    onPlayEpisode(episodeContentItem);
  }, [onPlayEpisode, seriesItem, seriesPoster]);


  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-full" aria-live="polite" aria-busy="true">
        <div className="w-10 h-10 border-4 border-sv-text-primary/30 border-t-sv-accent-cyan rounded-full animate-spin"></div>
        <p className="ml-3 text-lg text-sv-text-secondary">Loading episodes...</p>
      </div>
    );
  }
  
  if (!seriesItem) return <EmptyState title="Series Not Found" description="The requested series could not be loaded." />;


  return (
    <div className="p-8">
      <button onClick={onBack} className="mb-8 px-4 py-2 bg-sv-glass-search backdrop-blur-md border border-sv-border-glass hover:border-sv-accent-cyan/50 rounded-lg text-sm text-sv-text-primary shadow-md">&larr; Back</button> 
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <img 
          src={seriesPoster || seriesItem.poster || `https://picsum.photos/seed/${seriesItem.id}/300/450`} 
          alt={seriesItem.name} 
          className="w-full md:w-1/3 lg:w-1/4 h-auto object-cover rounded-2xl shadow-2xl aspect-[2/3]"
          onError={(e) => (e.currentTarget.src = `https://picsum.photos/seed/${seriesItem.id}/300/450`)}
        />
        <div className="flex-1">
          <h1 className="text-4xl lg:text-5xl font-bold text-sv-text-primary mb-3">{seriesItem.name}</h1>
          <p className="text-sm text-sv-text-secondary mb-1.5">Category: {seriesItem.group || 'N/A'}</p>
          {seriesItem.year && <p className="text-sm text-sv-text-secondary mb-1.5">Year: {seriesItem.year}</p>}
          {seriesItem.rating && <p className="text-sm text-sv-text-secondary mb-5">Rating: {seriesItem.rating}</p>}
        </div>
      </div>

      {seasons.length === 0 && !isLoading && (
        <EmptyState title="No Episodes Found" description={`No episodes are currently listed for "${seriesItem.name}". This might be due to the source not providing episode details or an error during fetching.`} />
      )}

      <div className="space-y-4">
        {seasons.map((season) => (
          <div key={season.season_number} className="bg-sv-glass-card backdrop-blur-md border border-sv-border-glass rounded-2xl shadow-lg">
            <button 
              onClick={() => toggleSeason(season.season_number)}
              className="w-full flex justify-between items-center p-5 text-left hover:bg-sv-hover-bg/50 rounded-t-2xl transition-colors"
              aria-expanded={openSeason === season.season_number}
              aria-controls={`season-content-${season.season_number}`}
            >
              <h2 className="text-xl font-semibold text-sv-text-primary">{season.name || `Season ${season.season_number}`}</h2>
              {openSeason === season.season_number ? <ChevronUpIcon className="w-5 h-5 text-sv-text-secondary" /> : <ChevronDownIcon className="w-5 h-5 text-sv-text-secondary" />}
            </button>
            {openSeason === season.season_number && (
              <div id={`season-content-${season.season_number}`} className="p-5 border-t border-sv-border-glass/50">
                {season.episodes.length === 0 ? (
                    <p className="text-sv-text-secondary text-sm">No episodes found for this season.</p>
                ) : (
                    <ul className="space-y-2">
                    {season.episodes.map((episode) => {
                        const savedTimeStr = localStorage.getItem(`video-time-${episode.id}`);
                        const savedDurationStr = localStorage.getItem(`video-duration-${episode.id}`);
                        let statusText: string | null = null;
                        let statusClasses: string = '';

                        if (savedTimeStr && savedDurationStr) {
                            const savedTime = parseFloat(savedTimeStr);
                            const savedDuration = parseFloat(savedDurationStr);
                            if (isFinite(savedTime) && isFinite(savedDuration) && savedDuration > 0) {
                                const progressPercent = (savedTime / savedDuration) * 100;
                                if (progressPercent >= 98) {
                                    statusText = 'WATCHED';
                                    statusClasses = 'bg-sv-success text-sv-bg-deep';
                                } else if (savedTime > 5 && progressPercent < 98) {
                                    statusText = 'WATCHING';
                                    statusClasses = 'bg-sv-warning text-sv-bg-deep';
                                }
                            }
                        }
                        return (
                            <li key={episode.id}>
                            <button 
                                onClick={() => handleEpisodePlay(episode)}
                                className="w-full text-left px-4 py-3 rounded-lg hover:bg-sv-hover-bg hover:text-sv-accent-cyan transition-colors text-sv-text-secondary flex justify-between items-center group"
                                aria-label={`Play Episode ${episode.episode}: ${episode.title}${statusText ? ` (${statusText})` : ''}`}
                            >
                                <span className="group-hover:text-sv-accent-cyan">Episode {episode.episode}: {episode.title}</span>
                                {statusText && (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClasses} ml-auto`}>
                                    {statusText}
                                </span>
                                )}
                            </button>
                            </li>
                        );
                    })}
                    </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
export const SeriesDetailPageView = React.memo(MemoizedSeriesDetailPageView);

type ContinueWatchingAllPageViewProps = Pick<PageViewProps, 'onPlayContent' | 'onRemoveFromContinueWatching' | 'onNavigate' | 'onViewSeriesDetail' | 'onRequestClearAllContinueWatching' | 'continueWatchingItems'>;

const MemoizedContinueWatchingAllPageView: React.FC<ContinueWatchingAllPageViewProps> = ({ 
    onPlayContent, onRemoveFromContinueWatching, onNavigate, onViewSeriesDetail, onRequestClearAllContinueWatching, continueWatchingItems = []
}) => {

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-sv-text-primary">
                    Continue Watching ({continueWatchingItems.length})
                </h1>
                <div className="flex items-center gap-4">
                    {continueWatchingItems.length > 0 && onRequestClearAllContinueWatching && (
                        <button
                            onClick={onRequestClearAllContinueWatching}
                            className="px-5 py-2 bg-sv-danger text-white font-semibold rounded-lg hover:bg-opacity-80 transition-colors text-sm shadow-md"
                            aria-label="Clear all continue watching items"
                        >
                            Clear All
                        </button>
                    )}
                    <button 
                        onClick={() => onNavigate(Page.Home)}
                        className="text-sm text-sv-accent-cyan hover:underline focus:outline-none focus:ring-2 focus:ring-sv-accent-purple rounded px-2 py-1"
                    >
                        &larr; Back to Home
                    </button>
                </div>
            </div>
            {continueWatchingItems.length === 0 ? (
                 <EmptyState 
                    icon={<TvIcon className="w-12 h-12 opacity-50" />} 
                    title="Nothing to Continue" 
                    description="You haven't started watching anything yet, or you've finished everything!"
                 />
            ) : (
                 <ContentGrid 
                    items={continueWatchingItems} 
                    onPlay={onPlayContent} 
                    showRemoveButtonInGrid={true} 
                    onRemoveItemFromGrid={onRemoveFromContinueWatching}
                    onViewSeriesDetail={onViewSeriesDetail}
                />
            )}
        </div>
    );
};
export const ContinueWatchingAllPageView = React.memo(MemoizedContinueWatchingAllPageView);


type WatchHistoryPageViewProps = Pick<PageViewProps, 'watchHistory' | 'onPlayContent' | 'onNavigate' | 'onViewSeriesDetail' | 'onRequestClearAllWatchHistory' | 'onRemoveFromHistory' | 'onRateContent'>;

const MemoizedWatchHistoryPageView: React.FC<WatchHistoryPageViewProps> = ({ 
    watchHistory = [], onPlayContent, onNavigate, onViewSeriesDetail, 
    onRequestClearAllWatchHistory, onRemoveFromHistory, onRateContent
}) => {
    
    const sortedHistory = useMemo(() => 
        [...(watchHistory || [])].sort((a, b) => (b.watchedOn || 0) - (a.watchedOn || 0))
    , [watchHistory]);

    return (
        <div className="p-8">
             <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-sv-text-primary">
                    Watched History ({sortedHistory.length})
                </h1>
                <div className="flex items-center gap-4">
                     {sortedHistory.length > 0 && onRequestClearAllWatchHistory && (
                        <button
                            onClick={onRequestClearAllWatchHistory}
                            className="px-5 py-2 bg-sv-danger text-white font-semibold rounded-lg hover:bg-opacity-80 transition-colors text-sm shadow-md"
                            aria-label="Clear all watched history items"
                        >
                            Clear All History
                        </button>
                    )}
                    <button 
                        onClick={() => onNavigate(Page.Home)}
                        className="text-sm text-sv-accent-cyan hover:underline focus:outline-none focus:ring-2 focus:ring-sv-accent-purple rounded px-2 py-1"
                    >
                        &larr; Back to Home
                    </button>
                </div>
            </div>
            {sortedHistory.length === 0 ? (
                 <EmptyState 
                    icon={<ListBulletIcon className="w-12 h-12 opacity-50" />} 
                    title="History is Empty" 
                    description="You haven't watched any content yet. Start exploring!"
                 />
            ) : (
                <ContentGrid 
                    items={sortedHistory} 
                    onPlay={onPlayContent} 
                    showRemoveButtonInGrid={false} 
                    onViewSeriesDetail={onViewSeriesDetail}
                    showRateButtonInGrid={true}
                    onRateItemInGrid={onRateContent}
                    showRemoveFromHistoryButtonInGrid={true}
                    onRemoveItemFromHistoryGrid={onRemoveFromHistory}
                />
            )}
        </div>
    );
};
export const WatchHistoryPageView = React.memo(MemoizedWatchHistoryPageView);
