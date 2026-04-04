import * as crypto from 'crypto';
import * as vscode from 'vscode';

const log = vscode.window.createOutputChannel('Subsonic Player');

export interface SubsonicConfig {
  serverUrl: string;
  username: string;
  password: string;
}

export interface Artist {
  id: string;
  name: string;
  albumCount?: number;
  coverArt?: string;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  coverArt?: string;
  songCount: number;
  duration: number;
  year?: number;
  genre?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId: string;
  coverArt?: string;
  duration: number;
  track?: number;
  year?: number;
  genre?: string;
  suffix?: string;
  bitRate?: number;
}

export interface Playlist {
  id: string;
  name: string;
  songCount: number;
  duration: number;
  coverArt?: string;
  smart?: boolean;
  comment?: string;
}

export interface SearchResult {
  artists: Artist[];
  albums: Album[];
  songs: Song[];
}

export interface LyricLine {
  start?: number; // timestamp in milliseconds
  value: string;
}

export interface StructuredLyric {
  lang: string;
  synced: boolean;
  line: LyricLine[];
  displayTitle?: string;
  displayArtist?: string;
  offset?: number;
}

export class SubsonicClient {
  private config: SubsonicConfig;
  private clientName = 'VSCodeSubsonicPlayer';
  private apiVersion = '1.16.1';
  private ndToken: string | null = null;

  constructor(config: SubsonicConfig) {
    this.config = config;
  }

  updateConfig(config: SubsonicConfig) {
    this.config = config;
    this.ndToken = null;
  }

  private buildUrl(endpoint: string, params: Record<string, string> = {}): string {
    const salt = crypto.randomBytes(8).toString('hex');
    const token = crypto.createHash('md5').update(this.config.password + salt).digest('hex');

    const url = new URL(`/rest/${endpoint}`, this.config.serverUrl);
    url.searchParams.set('u', this.config.username);
    url.searchParams.set('t', token);
    url.searchParams.set('s', salt);
    url.searchParams.set('v', this.apiVersion);
    url.searchParams.set('c', this.clientName);
    url.searchParams.set('f', 'json');

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = this.buildUrl(endpoint, params);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json() as any;
    if (data['subsonic-response']?.status === 'failed') {
      throw new Error(data['subsonic-response'].error?.message || 'Unknown error');
    }
    return data['subsonic-response'] as T;
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.request<any>('ping');
      return res.status === 'ok';
    } catch {
      return false;
    }
  }

  async getArtists(): Promise<Artist[]> {
    const res = await this.request<any>('getArtists');
    const artists: Artist[] = [];
    for (const index of res.artists?.index || []) {
      for (const artist of index.artist || []) {
        artists.push({
          id: artist.id,
          name: artist.name,
          albumCount: artist.albumCount,
          coverArt: artist.coverArt,
        });
      }
    }
    return artists;
  }

  async getArtist(id: string): Promise<{ artist: Artist; albums: Album[] }> {
    const res = await this.request<any>('getArtist', { id });
    return {
      artist: {
        id: res.artist.id,
        name: res.artist.name,
        albumCount: res.artist.albumCount,
        coverArt: res.artist.coverArt,
      },
      albums: (res.artist.album || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        artist: a.artist,
        artistId: a.artistId,
        coverArt: a.coverArt,
        songCount: a.songCount,
        duration: a.duration,
        year: a.year,
        genre: a.genre,
      })),
    };
  }

  async getAlbum(id: string): Promise<{ album: Album; songs: Song[] }> {
    const res = await this.request<any>('getAlbum', { id });
    return {
      album: {
        id: res.album.id,
        name: res.album.name,
        artist: res.album.artist,
        artistId: res.album.artistId,
        coverArt: res.album.coverArt,
        songCount: res.album.songCount,
        duration: res.album.duration,
        year: res.album.year,
        genre: res.album.genre,
      },
      songs: (res.album.song || []).map((s: any) => this.mapSong(s)),
    };
  }

  async getAlbumList(type: string = 'recent', size: number = 50): Promise<Album[]> {
    const res = await this.request<any>('getAlbumList2', { type, size: size.toString() });
    return (res.albumList2?.album || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      artist: a.artist,
      artistId: a.artistId,
      coverArt: a.coverArt,
      songCount: a.songCount,
      duration: a.duration,
      year: a.year,
      genre: a.genre,
    }));
  }

  async getPlaylists(): Promise<Playlist[]> {
    const res = await this.request<any>('getPlaylists');
    return (res.playlists?.playlist || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      songCount: p.songCount,
      duration: p.duration,
      coverArt: p.coverArt,
      comment: p.comment,
    }));
  }

  /**
   * Fetch playlists from Navidrome's native API (includes smart/NSP playlists).
   * Falls back to Subsonic API if Navidrome API is unavailable.
   */
  async getAllPlaylists(): Promise<Playlist[]> {
    try {
      log.appendLine('[getAllPlaylists] Trying Navidrome native API...');
      const ndPlaylists = await this.navidromeGetPlaylists();
      log.appendLine(`[getAllPlaylists] Navidrome returned ${ndPlaylists.length} playlists`);
      ndPlaylists.forEach(p => log.appendLine(`  - "${p.name}" (smart=${p.smart}, songs=${p.songCount})`));
      if (ndPlaylists.length > 0) { return ndPlaylists; }
    } catch (err: any) {
      log.appendLine(`[getAllPlaylists] Navidrome API failed: ${err.message}`);
    }
    log.appendLine('[getAllPlaylists] Falling back to Subsonic API...');
    const subPlaylists = await this.getPlaylists();
    log.appendLine(`[getAllPlaylists] Subsonic returned ${subPlaylists.length} playlists`);
    subPlaylists.forEach(p => log.appendLine(`  - "${p.name}" (songs=${p.songCount})`));
    return subPlaylists;
  }

  private async navidromeLogin(): Promise<string> {
    if (this.ndToken) { return this.ndToken; }

    const loginUrl = `${this.config.serverUrl}/auth/login`;
    log.appendLine(`[navidromeLogin] POST ${loginUrl}`);
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.config.username,
        password: this.config.password,
      }),
    });
    log.appendLine(`[navidromeLogin] Response status: ${response.status}`);
    if (!response.ok) {
      const body = await response.text();
      log.appendLine(`[navidromeLogin] Response body: ${body}`);
      throw new Error(`Login failed: HTTP ${response.status}`);
    }
    const data = await response.json() as any;
    log.appendLine(`[navidromeLogin] Response keys: ${Object.keys(data).join(', ')}`);
    const token = data.token;
    if (!token) { throw new Error('No token in login response'); }
    log.appendLine(`[navidromeLogin] Got token OK`);
    this.ndToken = token;
    return token;
  }

  private async navidromeRequest<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const token = await this.navidromeLogin();
    const url = new URL(`/api/${path}`, this.config.serverUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const response = await fetch(url.toString(), {
      headers: { 'x-nd-authorization': `Bearer ${token}` },
    });
    if (response.status === 401) {
      // Token expired, retry once
      this.ndToken = null;
      const newToken = await this.navidromeLogin();
      const retry = await fetch(url.toString(), {
        headers: { 'x-nd-authorization': `Bearer ${newToken}` },
      });
      if (!retry.ok) { throw new Error(`HTTP ${retry.status}`); }
      return await retry.json() as T;
    }
    if (!response.ok) { throw new Error(`HTTP ${response.status}`); }
    return await response.json() as T;
  }

  private async navidromeGetPlaylists(): Promise<Playlist[]> {
    const data = await this.navidromeRequest<any>('playlist', {
      _end: '500',
      _order: 'ASC',
      _sort: 'name',
      _start: '0',
    });
    log.appendLine(`[navidromeGetPlaylists] Response type: ${typeof data}, isArray: ${Array.isArray(data)}`);
    if (data && !Array.isArray(data)) {
      log.appendLine(`[navidromeGetPlaylists] Raw response: ${JSON.stringify(data).substring(0, 500)}`);
    }
    if (!Array.isArray(data)) { throw new Error('Unexpected response format'); }
    if (data.length > 0) {
      log.appendLine(`[navidromeGetPlaylists] First item keys: ${Object.keys(data[0]).join(', ')}`);
      log.appendLine(`[navidromeGetPlaylists] First item: ${JSON.stringify(data[0]).substring(0, 300)}`);
    }

    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      songCount: p.songCount ?? p.size ?? 0,
      duration: p.duration ?? 0,
      coverArt: p.coverArt || undefined,
      smart: p.rules ? true : false,
      comment: p.comment,
    }));
  }

  async getPlaylist(id: string): Promise<{ playlist: Playlist; songs: Song[] }> {
    const res = await this.request<any>('getPlaylist', { id });
    return {
      playlist: {
        id: res.playlist.id,
        name: res.playlist.name,
        songCount: res.playlist.songCount,
        duration: res.playlist.duration,
        coverArt: res.playlist.coverArt,
      },
      songs: (res.playlist.entry || []).map((s: any) => this.mapSong(s)),
    };
  }

  async search(query: string): Promise<SearchResult> {
    const res = await this.request<any>('search3', {
      query,
      artistCount: '20',
      albumCount: '20',
      songCount: '50',
    });
    return {
      artists: (res.searchResult3?.artist || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        albumCount: a.albumCount,
        coverArt: a.coverArt,
      })),
      albums: (res.searchResult3?.album || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        artist: a.artist,
        artistId: a.artistId,
        coverArt: a.coverArt,
        songCount: a.songCount,
        duration: a.duration,
        year: a.year,
        genre: a.genre,
      })),
      songs: (res.searchResult3?.song || []).map((s: any) => this.mapSong(s)),
    };
  }

  async getRandomSongs(size: number = 50): Promise<Song[]> {
    const res = await this.request<any>('getRandomSongs', { size: size.toString() });
    return (res.randomSongs?.song || []).map((s: any) => this.mapSong(s));
  }

  getStreamUrl(songId: string): string {
    return this.buildUrl('stream', { id: songId, format: 'mp3' });
  }

  getCoverArtUrl(coverArtId: string, size: string = '300'): string {
    return this.buildUrl('getCoverArt', { id: coverArtId, size });
  }

  async scrobble(songId: string): Promise<void> {
    await this.request('scrobble', { id: songId });
  }

  async getLyrics(songId: string): Promise<StructuredLyric[]> {
    try {
      const res = await this.request<any>('getLyricsBySongId', { id: songId });
      const lyrics = res.lyricsList?.structuredLyrics;
      if (!lyrics || !Array.isArray(lyrics)) { return []; }
      return lyrics.map((l: any) => ({
        lang: l.lang || '',
        synced: l.synced ?? false,
        line: (l.line || []).map((ln: any) => ({
          start: ln.start,
          value: ln.value || '',
        })),
        displayTitle: l.displayTitle,
        displayArtist: l.displayArtist,
        offset: l.offset,
      }));
    } catch {
      return [];
    }
  }

  private mapSong(s: any): Song {
    return {
      id: s.id,
      title: s.title,
      artist: s.artist,
      artistId: s.artistId,
      album: s.album,
      albumId: s.albumId,
      coverArt: s.coverArt,
      duration: s.duration,
      track: s.track,
      year: s.year,
      genre: s.genre,
      suffix: s.suffix,
      bitRate: s.bitRate,
    };
  }
}
