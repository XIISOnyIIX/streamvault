
import { ContentItem, LoadingState, SeasonInfo, EpisodeInfo, Playlist } from '../types';
import { FALLBACK_CONTENT } from '../constants';

export const SERIES_PLACEHOLDER_URL_PREFIX = "series_placeholder_id::";
const EPISODE_PLACEHOLDER_URL_PREFIX = "episode_placeholder_id::";


function cleanString(str: string): string {
  if (!str) return '';
  return str.replace(/[^\x00-\x7F]/g, "");
}

function generateDeterministicId(type: string, name?: string, seed?: string): string {
  const cleanName = name ? name.replace(/[^a-zA-Z0-9_]/g, '-').toLowerCase() : 'unknown';
  const cleanSeed = seed ? seed.replace(/[^a-zA-Z0-9_]/g, '-').toLowerCase() : 'unknownseed';
  // Keep IDs relatively short but unique enough for typical playlist sizes.
  // Using substrings and lengths to add some variability.
  return `${type}-${cleanName.substring(0,20)}-${cleanName.length}-${cleanSeed.substring(0,15)}-${cleanSeed.length}`;
}


export function parseM3UText(m3uText: string): ContentItem[] {
  const lines = m3uText.split('\n');
  const content: ContentItem[] = [];
  let currentItem: Partial<ContentItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = cleanString(lines[i]).trim();

    if (line.startsWith('#EXTINF:')) {
      currentItem = { type: 'channel' }; 

      const attributes = line.match(/([a-zA-Z0-9-]+)="([^"]*)"/g) || [];
      attributes.forEach((attr: string) => {
        const parts = attr.split('=').map(s => s.replace(/"/g, ''));
        const key = parts[0];
        const value = parts.length > 1 ? parts[1] : undefined;

        if (key === 'tvg-id' && typeof value === 'string') currentItem!.id = value;
        else if (key === 'tvg-name' && typeof value === 'string') currentItem!.name = value;
        else if (key === 'tvg-logo') currentItem!.poster = value;
        else if (key === 'group-title') currentItem!.group = value;
      });

      const titleMatch = line.match(/,(.*)$/);
      if (titleMatch && titleMatch[1]) {
        currentItem!.name = currentItem!.name || titleMatch[1].trim();
      }
      
      if (!currentItem!.id) {
        currentItem!.id = generateDeterministicId('m3u', currentItem!.name, currentItem!.group || '');
      }

      if (currentItem!.group) {
        const groupLower = currentItem!.group.toLowerCase();
        if (groupLower.includes('movie') || groupLower.includes('vod')) currentItem!.type = 'movie';
        else if (groupLower.includes('series') || groupLower.includes('tv show')) currentItem!.type = 'series';
      } else if (currentItem!.name) {
         const nameLower = currentItem!.name.toLowerCase();
        if (nameLower.includes('movie')) currentItem!.type = 'movie';
        else if (nameLower.match(/s\d{1,2}e\d{1,2}/i) || nameLower.includes('season')) currentItem!.type = 'series';
      }

    } else if (currentItem && (line.startsWith('http://') || line.startsWith('https://'))) {
      currentItem.url = line;
      if(currentItem.name && currentItem.url && currentItem.id) {
        content.push(currentItem as ContentItem);
      }
      currentItem = null;
    }
  }
  return content;
}

async function parseAndFetchXtreamDataViaIPC(
    baseUrl: string, username: string, password: string
): Promise<ContentItem[]> {
  const allContent: ContentItem[] = [];

  async function fetchAndParseAction<T extends {
    name?: string, 
    stream_id?: number | string, 
    series_id?: number | string, 
    vod_id?: number | string, 
    cover?: string, 
    stream_icon?: string, 
    category_name?: string, 
    category_id?: string | number, 
    rating?: string | number, 
    releaseDate?: string, 
    direct_source?: string, 
    num?: number | string, 
    season?: number | string, 
    container_extension?: string,
    episode_num?: number | string 
  }>(action: string, type: 'channel' | 'movie' | 'series'): Promise<void> {
    
    console.log(`Renderer: Requesting Xtream action '${action}' for ${baseUrl} from main process.`);
    const data: T[] | { user_info?: any, server_info?: any, available_channels?: Record<string, T>, movie_data?: Record<string, T> } = 
        await window.electronAPI.fetchXtreamCodes(baseUrl, username, password, action);
    console.log(`Renderer: Received data for Xtream action '${action}':`, data);
    
    let itemsArray: T[] = [];
    if (Array.isArray(data)) {
        itemsArray = data;
    } else if (typeof data === 'object' && data !== null) {
        if (action === 'get_live_streams' && data.available_channels && typeof data.available_channels === 'object') {
            itemsArray = Object.values(data.available_channels);
        } else if (action === 'get_vod_streams' && data.movie_data && typeof data.movie_data === 'object') {
            itemsArray = Object.values(data.movie_data);
        }
    }


    if (itemsArray.length > 0) {
        itemsArray.forEach((item: T) => {
            let itemId: string;
            const rawSeriesId = item.series_id;
            const rawStreamId = item.stream_id;
            const rawVodId = item.vod_id;

            if (type === 'series' && (typeof rawSeriesId === 'string' || typeof rawSeriesId === 'number')) {
                itemId = String(rawSeriesId);
            } else if (type === 'movie' && (((typeof rawVodId === 'string' || typeof rawVodId === 'number')) || ((typeof rawStreamId === 'string' || typeof rawStreamId === 'number')))) {
                 // Prioritize vod_id if both exist and are valid, otherwise use stream_id if valid
                if (typeof rawVodId === 'string' || typeof rawVodId === 'number') {
                    itemId = String(rawVodId);
                } else {
                    itemId = String(rawStreamId);
                }
            } else if (type === 'channel' && (typeof rawStreamId === 'string' || typeof rawStreamId === 'number')) {
                itemId = String(rawStreamId);
            } else {
                const itemNameForId = item.name || 'UnknownTitle';
                const itemCategoryForId = String(item.category_name || item.category_id || 'UnknownGroup');
                itemId = generateDeterministicId(type, itemNameForId, itemCategoryForId);
                // console.log(`Generated fallback ID for ${type} "${itemNameForId}" in category "${itemCategoryForId}": ${itemId}`);
            }
            
            const contentItem: Partial<ContentItem> = {
              id: itemId,
              type: type,
              name: cleanString(item.name || 'Unknown Title'),
              poster: item.stream_icon || item.cover || `https://picsum.photos/seed/${itemId}/200/112`,
              group: cleanString(String(item.category_name || item.category_id || 'Unknown Group')),
            };

            const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            let extension: string;
            let streamUrlPath = ''; 

            if (type === 'channel' && (typeof item.stream_id === 'string' || typeof item.stream_id === 'number')) {
                extension = item.container_extension || 'ts'; 
                streamUrlPath = `/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${item.stream_id}.${extension}`;
                contentItem.url = (typeof item.direct_source === 'string' && (item.direct_source.startsWith('http://') || item.direct_source.startsWith('https://'))) 
                              ? item.direct_source 
                              : (cleanBaseUrl + streamUrlPath);
            } else if (type === 'movie' && (typeof (item.vod_id ?? item.stream_id) === 'string' || typeof (item.vod_id ?? item.stream_id) === 'number')) {
                const movieId = item.vod_id ?? item.stream_id;
                extension = item.container_extension || 
                            (typeof item.direct_source === 'string' && item.direct_source.includes('.') ? item.direct_source.split('.').pop()! : 'mp4');
                streamUrlPath = `/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${movieId}.${extension}`;
                contentItem.url = (typeof item.direct_source === 'string' && (item.direct_source.startsWith('http://') || item.direct_source.startsWith('https://'))) 
                              ? item.direct_source 
                              : (cleanBaseUrl + streamUrlPath);
            } else if (type === 'series' && (typeof item.series_id === 'string' || typeof item.series_id === 'number')) {
                contentItem.url = `${SERIES_PLACEHOLDER_URL_PREFIX}${item.series_id}`; 
                contentItem.seriesId = String(item.series_id); 
                const episodeNum = item.episode_num || item.num;
                if (episodeNum && item.season) {
                    contentItem.episode = `S${String(item.season).padStart(2,'0')}E${String(episodeNum).padStart(2,'0')}`;
                }
            } else { 
                contentItem.url = item.direct_source || `${cleanBaseUrl}/unknown_type_fallback/${itemId}`;
            }

            if (type === 'movie') {
              contentItem.rating = typeof item.rating === 'number' ? item.rating.toFixed(1) : (typeof item.rating === 'string' ? item.rating : undefined);
              contentItem.year = item.releaseDate ? (new Date(item.releaseDate).getFullYear() ? new Date(item.releaseDate).getFullYear().toString() : undefined) : undefined;
            }
            
            if(contentItem.id && contentItem.name && contentItem.url && contentItem.type){
                allContent.push(contentItem as ContentItem);
            }
      });
    } else {
      console.warn(`Renderer: No items found or unexpected data format for ${type} from Xtream Codes action ${action}:`, data);
    }
  }

  try { await fetchAndParseAction('get_live_streams', 'channel'); } 
  catch (error) { console.error(`Renderer: Failed to process 'get_live_streams':`, error); }
  
  try { await fetchAndParseAction('get_vod_streams', 'movie'); }
  catch (error) { console.error(`Renderer: Failed to process 'get_vod_streams' (movies):`, error); }
  
  try { await fetchAndParseAction('get_series', 'series'); }
  catch (error) { console.error(`Renderer: Failed to process 'get_series':`, error); }
  
  return allContent;
}


export async function fetchXtreamSeriesEpisodes(
  playlist: Playlist,
  seriesId: string,
  setLoadingState: (loading: LoadingState) => void
): Promise<{ seasons: SeasonInfo[], seriesPoster?: string } | null> {
  if (playlist.type !== 'xtream' || !playlist.serverUrl || !playlist.username || !playlist.password) {
    console.error("Cannot fetch series episodes: Not an Xtream playlist or missing credentials.");
    return null;
  }
  setLoadingState({ isLoading: true, message: `Fetching episodes for series ID ${seriesId}...` });

  try {
    const data = await window.electronAPI.fetchXtreamCodes(
      playlist.serverUrl,
      playlist.username,
      playlist.password,
      'get_series_info',
      { series_id: seriesId }
    );

    console.log("Renderer: Received series_info data:", data);

    if (!data || !data.episodes) {
      console.warn("No episodes found in series_info response or invalid format:", data);
      return null;
    }
    
    const seriesPoster = data.info?.cover_big || data.info?.movie_image || data.info?.cover;

    const seasonsMap: { [key: number]: SeasonInfo } = {};

    for (const seasonNumberStr in data.episodes) {
        const seasonNumber = parseInt(seasonNumberStr, 10);
        if (isNaN(seasonNumber)) continue;

        const episodesRaw = data.episodes[seasonNumberStr] as any[];
        const processedEpisodes: EpisodeInfo[] = episodesRaw.map((epRaw: any) => {
            const episodeStreamId = epRaw.id || epRaw.stream_id; 
            const episodeTitle = cleanString(epRaw.title || `Episode ${epRaw.episode_num || epRaw.id}`);
            
            let episodeUrl = `${EPISODE_PLACEHOLDER_URL_PREFIX}${episodeStreamId}`; 
            const cleanBaseUrl = playlist.serverUrl!.endsWith('/') ? playlist.serverUrl!.slice(0, -1) : playlist.serverUrl!;
            const extension = epRaw.container_extension || 'mp4';
            
            let epId = String(episodeStreamId);
            if (!epId || epId === "null" || epId === "undefined") { // Ensure epId is valid
                epId = generateDeterministicId('episode', episodeTitle, `s${seasonNumber}-series${seriesId}`);
            }


            if (episodeStreamId && playlist.username && playlist.password) {
                 episodeUrl = `${cleanBaseUrl}/series/${encodeURIComponent(playlist.username)}/${encodeURIComponent(playlist.password)}/${episodeStreamId}.${extension}`;
            } else if (epRaw.direct_source && (epRaw.direct_source.startsWith('http://') || epRaw.direct_source.startsWith('https://'))) {
                episodeUrl = epRaw.direct_source;
            }

            return {
                id: epId,
                title: episodeTitle,
                season: seasonNumber,
                episode: parseInt(epRaw.episode_num, 10) || 0,
                stream_id: episodeStreamId,
                container_extension: epRaw.container_extension,
                info: epRaw, 
                url: episodeUrl,
                poster: epRaw.info?.movie_image || epRaw.info?.cover || seriesPoster,
            };
        });
        
        const seasonCover = data.seasons?.find((s:any) => s.season_number === seasonNumber)?.cover_big || seriesPoster;


        seasonsMap[seasonNumber] = {
            season_number: seasonNumber,
            name: data.seasons?.find((s:any) => s.season_number === seasonNumber)?.name || `Season ${seasonNumber}`, 
            episodes: processedEpisodes,
            cover: seasonCover,
            air_date: data.seasons?.find((s:any) => s.season_number === seasonNumber)?.air_date,
            overview: data.seasons?.find((s:any) => s.season_number === seasonNumber)?.overview,
        };
    }
    
    const seasons = Object.values(seasonsMap).sort((a, b) => a.season_number - b.season_number);
    return { seasons, seriesPoster };

  } catch (error) {
    console.error(`Renderer: Error fetching series episodes for ID ${seriesId}:`, error);
    return null;
  } finally {
    setLoadingState({ isLoading: false, message: "" });
  }
}


export const handleAddPlaylist = async (
  connectionType: 'm3u' | 'xtream',
  params: { 
    name: string; 
    url?: string; 
    m3uFileContent?: string;
    serverUrl?: string; 
    username?: string; 
    password?: string 
  },
  setLoadingState: (loading: LoadingState) => void,
  showMessageBox: (title: string, message: string) => void
): Promise<ContentItem[] | null> => {
  setLoadingState({ isLoading: true, message: 'Processing playlist...' });

  try {
    let fetchedContent: ContentItem[] = [];
    if (connectionType === 'm3u') {
      if (params.m3uFileContent) {
        setLoadingState({ isLoading: true, message: `Parsing M3U file: ${params.name}...` });
        fetchedContent = parseM3UText(params.m3uFileContent);
      } else if (params.url) {
        if (!params.url) throw new Error('M3U URL is required.'); 
        setLoadingState({ isLoading: true, message: `Fetching M3U via Electron: ${params.url}...` });
        const m3uText = await window.electronAPI.fetchM3U(params.url);
        fetchedContent = parseM3UText(m3uText);
      } else {
        throw new Error('For M3U, either a file content or a URL must be provided.');
      }
    } else if (connectionType === 'xtream') {
      if (!params.name || !params.serverUrl || !params.username || !params.password) {
        throw new Error('All Xtream Codes fields (Name, Server URL, Username, Password) are required.');
      }
      setLoadingState({ isLoading: true, message: `Connecting to Xtream Codes via Electron: ${params.serverUrl}...` });
      fetchedContent = await parseAndFetchXtreamDataViaIPC(params.serverUrl, params.username, params.password);
    }

    // Tag content with playlist name
    if (fetchedContent) {
      fetchedContent.forEach(item => {
        item.playlistName = params.name;
      });
    }
    
    if (fetchedContent.length > 0) {
        showMessageBox('Playlist Added', `"${params.name}" has been successfully connected. Found ${fetchedContent.length} items.`);
    } else {
        showMessageBox('Playlist Processed', `"${params.name}" processed. No playable items were found.\nThis could be due to an empty source, an issue during fetching specific categories (like live, movies, or series), or a parsing error.\nCheck the console (View > Toggle Developer Tools in Electron, then Console tab) for more detailed logs.`);
    }
    return fetchedContent;

  } catch (error: any) {
    console.error("Renderer: Error adding playlist:", error);
    const errorMessage = `Failed to connect or process playlist "${params.name}": ${error.message || 'An unknown error occurred.'}\n\n- Ensure the URL/details are correct and accessible from your network.\n- Check the Electron main process console (terminal where you ran 'npm start') and the Renderer console (View > Toggle Developer Tools > Console) for more details.\n\nFallback data will be used if available for this preview.`;
    
    let fallbackData: ContentItem[] = [];
    const isFetchAttempt = connectionType === 'xtream' || (connectionType === 'm3u' && !!params.url && !params.m3uFileContent);

    if (isFetchAttempt) {
        fallbackData = [...FALLBACK_CONTENT.channels, ...FALLBACK_CONTENT.movies, ...FALLBACK_CONTENT.series];
        // Tag fallback content with playlist name as well
        fallbackData.forEach(item => {
          item.playlistName = params.name;
        });
        showMessageBox('Connection Failed (Electron)', errorMessage);
        return fallbackData; 
    } else { 
        showMessageBox('Error Processing Playlist', `Failed to process playlist "${params.name}": ${error.message}. Please check the file or input details, and the Renderer console for more info.`);
        return null;
    }

  } finally {
    setLoadingState({ isLoading: false, message: '' });
  }
};