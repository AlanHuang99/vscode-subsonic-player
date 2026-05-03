import * as vscode from 'vscode';
import { SubsonicClient, Song, Album, Playlist } from './api/subsonic';
import { LibraryProvider } from './providers/libraryProvider';
import { PlaylistProvider } from './providers/playlistProvider';
import { QueueItem, QueueProvider } from './providers/queueProvider';
import { AlbumPanel } from './webview/albumPanel';
import { PlayerPanel } from './webview/playerPanel';
import { PlaylistPanel } from './webview/playlistPanel';
import { ServerManager } from './serverManager';

let client: SubsonicClient;
let statusBarItem: vscode.StatusBarItem;
let serverStatusBarItem: vscode.StatusBarItem;
let serverManager: ServerManager;
let currentSongId: string | undefined;
let currentSong: Song | undefined;
let playbackOptions = { shuffleOn: false, repeatMode: 0 };

type QueueAction = 'playNow' | 'playNext' | 'addToQueue';

export async function activate(context: vscode.ExtensionContext) {
  serverManager = new ServerManager(context.globalState, context.secrets);

  // Migrate old plain-text settings on first run
  await serverManager.migrateFromSettings();

  // Initialize client with active server or empty config
  const creds = await serverManager.getActiveCredentials();
  client = new SubsonicClient(creds || { serverUrl: '', username: '', password: '' });

  const libraryProvider = new LibraryProvider(client);
  const playlistProvider = new PlaylistProvider(client);
  const queueProvider = new QueueProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('subsonicPlayer.library', libraryProvider),
    vscode.window.registerTreeDataProvider('subsonicPlayer.playlists', playlistProvider),
    vscode.window.registerTreeDataProvider('subsonicPlayer.queue', queueProvider),
  );

  // Player status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'subsonicPlayer.playPause';
  statusBarItem.text = '$(play) Music';
  statusBarItem.tooltip = 'Subsonic Player';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Server status bar
  serverStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  serverStatusBarItem.command = 'subsonicPlayer.switchServer';
  updateServerStatusBar();
  serverStatusBarItem.show();
  context.subscriptions.push(serverStatusBarItem);

  function updateServerStatusBar() {
    const server = serverManager.getActiveServer();
    if (server) {
      serverStatusBarItem.text = `$(server) ${server.name}`;
      serverStatusBarItem.tooltip = `Connected to ${server.username}@${server.url}\nClick to switch server`;
    } else {
      serverStatusBarItem.text = '$(server) Not connected';
      serverStatusBarItem.tooltip = 'Click to add a server';
    }
  }

  async function reconnect() {
    const creds = await serverManager.getActiveCredentials();
    if (creds) {
      client.updateConfig(creds);
    } else {
      client.updateConfig({ serverUrl: '', username: '', password: '' });
      currentSongId = undefined;
      currentSong = undefined;
      libraryProvider.setNowPlaying(undefined);
      queueProvider.clear();
    }
    updateServerStatusBar();
    libraryProvider.refresh();
    playlistProvider.refresh();

    // Test connection
    if (creds?.serverUrl) {
      const ok = await client.ping();
      if (ok) {
        vscode.window.setStatusBarMessage('Subsonic Player: Connected', 3000);
      } else {
        vscode.window.showWarningMessage('Subsonic Player: Could not connect to server.');
      }
    }
  }

  // React to server changes
  context.subscriptions.push(serverManager.onDidChange(() => reconnect()));

  function playSong(song: Song) {
    currentSongId = song.id;
    currentSong = song;
    libraryProvider.setNowPlaying(song);
    const streamUrl = client.getStreamUrl(song.id);
    const coverUrl = song.coverArt ? client.getCoverArtUrl(song.coverArt) : '';
    const songId = song.id;

    function sendTrackAndLyrics() {
      PlayerPanel.currentPanel?.updateTrack(song, streamUrl, coverUrl);
      client.getLyrics(songId).then((lyrics) => {
        if (lyrics.length > 0 && currentSongId === songId) {
          PlayerPanel.currentPanel?.updateLyrics(songId, lyrics);
        }
      }).catch(() => {});
    }

    if (!PlayerPanel.currentPanel) {
      PlayerPanel.createOrShow(context.extensionUri, handlePanelCommand);
      setTimeout(sendTrackAndLyrics, 500);
    } else {
      sendTrackAndLyrics();
    }

    statusBarItem.text = `$(play) ${song.title} - ${song.artist}`;
    statusBarItem.tooltip = `${song.title}\n${song.artist} - ${song.album}`;

    client.scrobble(song.id).catch(() => {});
  }

  function handlePanelCommand(command: string, data?: any) {
    switch (command) {
      case 'next': {
        updatePlaybackOptions(data);
        const next = queueProvider.next(playbackOptions.shuffleOn, playbackOptions.repeatMode === 1);
        if (next) { playSong(next); }
        break;
      }
      case 'previous': {
        const prev = queueProvider.previous();
        if (prev) { playSong(prev); }
        break;
      }
      case 'shuffle':
        if (typeof data?.enabled === 'boolean') {
          playbackOptions = { ...playbackOptions, shuffleOn: data.enabled };
        }
        break;
      case 'repeat':
        if (typeof data?.mode === 'number') {
          playbackOptions = { ...playbackOptions, repeatMode: data.mode };
        }
        break;
    }
  }

  function updatePlaybackOptions(data?: any) {
    if (typeof data?.shuffleOn === 'boolean') {
      playbackOptions = { ...playbackOptions, shuffleOn: data.shuffleOn };
    }
    if (typeof data?.repeatMode === 'number') {
      playbackOptions = { ...playbackOptions, repeatMode: data.repeatMode };
    }
  }

  function getAlbum(input: Album | { album?: Album } | undefined): Album | undefined {
    return (input as { album?: Album } | undefined)?.album ?? input as Album | undefined;
  }

  function getPlaylist(input: Playlist | { playlist?: Playlist } | undefined): Playlist | undefined {
    return (input as { playlist?: Playlist } | undefined)?.playlist ?? input as Playlist | undefined;
  }

  function getSong(input: Song | { song?: Song } | undefined): Song | undefined {
    return (input as { song?: Song } | undefined)?.song ?? input as Song | undefined;
  }

  function getQueueIndex(input: QueueItem | number | undefined): number | undefined {
    if (typeof input === 'number') { return input; }
    return input?.index;
  }

  function getPlaylistSongArgs(input: any, index?: number): { playlistId: string; index: number; song?: Song } | undefined {
    if (typeof input === 'string' && typeof index === 'number') {
      return { playlistId: input, index };
    }

    if (typeof input?.playlistId === 'string' && typeof input?.index === 'number') {
      return { playlistId: input.playlistId, index: input.index, song: input.song };
    }

    return undefined;
  }

  function formatTrackCount(count: number): string {
    return `${count} ${count === 1 ? 'track' : 'tracks'}`;
  }

  function showQueuedMessage(action: string, songs: Song[], source?: string) {
    const suffix = source ? `: ${source}` : '';
    vscode.window.setStatusBarMessage(`Subsonic Player: ${action} ${formatTrackCount(songs.length)}${suffix}`, 2500);
  }

  function refreshMusicViews() {
    libraryProvider.refresh();
    playlistProvider.refresh();
    queueProvider.refresh();
  }

  function markSongFavorite(song: Song, starred: boolean) {
    song.starred = starred ? new Date().toISOString() : undefined;
    for (const queuedSong of queueProvider.getQueue()) {
      if (queuedSong.id === song.id) {
        queuedSong.starred = song.starred;
      }
    }
    if (currentSong?.id === song.id) {
      currentSong.starred = song.starred;
      libraryProvider.setNowPlaying(currentSong);
    }
  }

  function markAlbumFavorite(album: Album, starred: boolean) {
    album.starred = starred ? new Date().toISOString() : undefined;
  }

  async function toggleFavoriteSong(songInput: Song | { song?: Song } | undefined): Promise<boolean> {
    const song = getSong(songInput);
    if (!song) {
      vscode.window.showWarningMessage('Select a track first.');
      return false;
    }

    const nextStarred = !song.starred;
    if (nextStarred) {
      await client.starSong(song.id);
    } else {
      await client.unstarSong(song.id);
    }

    markSongFavorite(song, nextStarred);
    refreshMusicViews();
    vscode.window.setStatusBarMessage(`Subsonic Player: ${nextStarred ? 'Favorited' : 'Unfavorited'} "${song.title}"`, 2500);
    return true;
  }

  async function toggleFavoriteAlbum(albumInput: Album | { album?: Album } | undefined): Promise<boolean> {
    const album = getAlbum(albumInput);
    if (!album) {
      vscode.window.showWarningMessage('Select an album first.');
      return false;
    }

    const nextStarred = !album.starred;
    if (nextStarred) {
      await client.starAlbum(album.id);
    } else {
      await client.unstarAlbum(album.id);
    }

    markAlbumFavorite(album, nextStarred);
    refreshMusicViews();
    vscode.window.setStatusBarMessage(`Subsonic Player: ${nextStarred ? 'Favorited' : 'Unfavorited'} "${album.name}"`, 2500);
    return true;
  }

  function resetPlayerState() {
    currentSongId = undefined;
    currentSong = undefined;
    libraryProvider.setNowPlaying(undefined);
    statusBarItem.text = '$(play) Music';
    statusBarItem.tooltip = 'Subsonic Player';
    PlayerPanel.currentPanel?.stopPlayback();
  }

  function queueSongs(songs: Song[], action: QueueAction, source?: string, startIndex: number = 0) {
    if (songs.length === 0) {
      vscode.window.showWarningMessage('No tracks found.');
      return;
    }

    switch (action) {
      case 'playNow': {
        const safeIndex = Math.min(Math.max(startIndex, 0), songs.length - 1);
        queueProvider.setQueue(songs, safeIndex);
        playSong(songs[safeIndex]);
        break;
      }
      case 'playNext': {
        const insertIndex = queueProvider.insertNext(songs);
        if (!currentSongId) {
          queueProvider.setCurrentIndex(insertIndex);
          playSong(songs[0]);
        } else {
          showQueuedMessage('Queued next', songs, source);
        }
        break;
      }
      case 'addToQueue':
        queueProvider.append(songs);
        showQueuedMessage('Added', songs, source);
        break;
    }
  }

  async function getAlbumSongs(albumInput: Album | { album?: Album } | undefined): Promise<{ album?: Album; songs: Song[] }> {
    const album = getAlbum(albumInput);
    if (!album) {
      vscode.window.showWarningMessage('Select an album from the music library first.');
      return { songs: [] };
    }

    return await client.getAlbum(album.id);
  }

  async function getPlaylistSongs(playlistInput: Playlist | { playlist?: Playlist } | undefined): Promise<{ playlist?: Playlist; songs: Song[] }> {
    const playlist = getPlaylist(playlistInput);
    if (!playlist) {
      vscode.window.showWarningMessage('Select a playlist from the music library first.');
      return { songs: [] };
    }

    return { playlist, songs: await playlistProvider.getSongs(playlist.id) };
  }

  function showAlbumPanel(album: Album, songs: Song[]) {
    const coverUrl = album.coverArt ? client.getCoverArtUrl(album.coverArt, '300') : '';
    const currentAlbum = album;
    const currentAlbumSongs = songs;

    AlbumPanel.createOrShow(async (command, data) => {
      switch (command) {
        case 'playAll':
          queueSongs(currentAlbumSongs, 'playNow', currentAlbum.name);
          break;
        case 'playNext':
          queueSongs(currentAlbumSongs, 'playNext', currentAlbum.name);
          break;
        case 'addToQueue':
          queueSongs(currentAlbumSongs, 'addToQueue', currentAlbum.name);
          break;
        case 'toggleFavoriteAlbum':
          if (await toggleFavoriteAlbum(currentAlbum)) {
            AlbumPanel.currentPanel?.showAlbum(currentAlbum, currentAlbumSongs, coverUrl);
          }
          break;
        case 'toggleFavoriteSong':
          if (data?.index != null && currentAlbumSongs[data.index]) {
            if (await toggleFavoriteSong(currentAlbumSongs[data.index])) {
              AlbumPanel.currentPanel?.showAlbum(currentAlbum, currentAlbumSongs, coverUrl);
            }
          }
          break;
        case 'playSong':
          if (data?.index != null) {
            queueSongs(currentAlbumSongs, 'playNow', currentAlbum.name, data.index);
          }
          break;
      }
    });

    AlbumPanel.currentPanel?.showAlbum(currentAlbum, currentAlbumSongs, coverUrl);
  }

  // Commands
  context.subscriptions.push(
    // --- Server management ---
    vscode.commands.registerCommand('subsonicPlayer.addServer', () => {
      serverManager.promptAddServer();
    }),

    vscode.commands.registerCommand('subsonicPlayer.switchServer', () => {
      serverManager.promptSwitchServer();
    }),

    vscode.commands.registerCommand('subsonicPlayer.removeServer', () => {
      serverManager.promptRemoveServer();
    }),

    // --- Player ---
    vscode.commands.registerCommand('subsonicPlayer.openPlayer', () => {
      PlayerPanel.createOrShow(context.extensionUri, handlePanelCommand);
    }),

    vscode.commands.registerCommand('subsonicPlayer.playPause', () => {
      if (PlayerPanel.currentPanel) {
        PlayerPanel.currentPanel.togglePlayPause();
      } else {
        PlayerPanel.createOrShow(context.extensionUri, handlePanelCommand);
      }
    }),

    vscode.commands.registerCommand('subsonicPlayer.next', () => {
      const next = queueProvider.next(playbackOptions.shuffleOn, playbackOptions.repeatMode === 1);
      if (next) { playSong(next); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.previous', () => {
      const prev = queueProvider.previous();
      if (prev) { playSong(prev); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.playAlbum', async (album: Album) => {
      const result = await getAlbumSongs(album);
      queueSongs(result.songs, 'playNow', result.album?.name);
    }),

    vscode.commands.registerCommand('subsonicPlayer.showAlbum', async (album: Album) => {
      const result = await getAlbumSongs(album);
      if (result.album) {
        showAlbumPanel(result.album, result.songs);
      }
    }),

    vscode.commands.registerCommand('subsonicPlayer.playAlbumNext', async (album: Album) => {
      const result = await getAlbumSongs(album);
      queueSongs(result.songs, 'playNext', result.album?.name);
    }),

    vscode.commands.registerCommand('subsonicPlayer.addAlbumToQueue', async (album: Album) => {
      const result = await getAlbumSongs(album);
      queueSongs(result.songs, 'addToQueue', result.album?.name);
    }),

    vscode.commands.registerCommand('subsonicPlayer.toggleFavoriteAlbum', async (album: Album) => {
      await toggleFavoriteAlbum(album);
    }),

    vscode.commands.registerCommand('subsonicPlayer.showPlaylist', async (playlist: Playlist) => {
      const result = await getPlaylistSongs(playlist);
      if (!result.playlist) { return; }
      const activePlaylist = result.playlist;
      const songs = result.songs;
      const coverUrls = new Map<string, string>();
      for (const song of songs) {
        if (song.coverArt) {
          coverUrls.set(song.id, client.getCoverArtUrl(song.coverArt, '64'));
        }
      }

      const currentPlaylistSongs = songs;

      PlaylistPanel.createOrShow(async (command, data) => {
        switch (command) {
          case 'playAll':
            queueSongs(currentPlaylistSongs, 'playNow', activePlaylist.name);
            break;
          case 'playNext':
            queueSongs(currentPlaylistSongs, 'playNext', activePlaylist.name);
            break;
          case 'addToQueue':
            queueSongs(currentPlaylistSongs, 'addToQueue', activePlaylist.name);
            break;
          case 'playSong':
            if (data?.index != null) {
              queueSongs(currentPlaylistSongs, 'playNow', activePlaylist.name, data.index);
            }
            break;
          case 'playSongNext':
            if (data?.index != null && currentPlaylistSongs[data.index]) {
              queueSongs([currentPlaylistSongs[data.index]], 'playNext', currentPlaylistSongs[data.index].title);
            }
            break;
          case 'addSongToQueue':
            if (data?.index != null && currentPlaylistSongs[data.index]) {
              queueSongs([currentPlaylistSongs[data.index]], 'addToQueue', currentPlaylistSongs[data.index].title);
            }
            break;
          case 'toggleFavoriteSong':
            if (data?.index != null && currentPlaylistSongs[data.index]) {
              if (await toggleFavoriteSong(currentPlaylistSongs[data.index])) {
                PlaylistPanel.currentPanel?.showPlaylist(activePlaylist, currentPlaylistSongs, coverUrls);
              }
            }
            break;
        }
      });

      setTimeout(() => {
        PlaylistPanel.currentPanel?.showPlaylist(activePlaylist, songs, coverUrls);
      }, 100);
    }),

    vscode.commands.registerCommand('subsonicPlayer.playPlaylist', async (playlist: Playlist) => {
      const result = await getPlaylistSongs(playlist);
      queueSongs(result.songs, 'playNow', result.playlist?.name);
    }),

    vscode.commands.registerCommand('subsonicPlayer.playPlaylistNext', async (playlist: Playlist) => {
      const result = await getPlaylistSongs(playlist);
      queueSongs(result.songs, 'playNext', result.playlist?.name);
    }),

    vscode.commands.registerCommand('subsonicPlayer.addPlaylistToQueue', async (playlist: Playlist) => {
      const result = await getPlaylistSongs(playlist);
      queueSongs(result.songs, 'addToQueue', result.playlist?.name);
    }),

    vscode.commands.registerCommand('subsonicPlayer.playFromPlaylist', async (playlistIdOrItem: string | any, index?: number) => {
      const args = getPlaylistSongArgs(playlistIdOrItem, index);
      if (!args) { return; }
      const songs = await playlistProvider.getSongs(args.playlistId);
      queueSongs(songs, 'playNow', undefined, args.index);
    }),

    vscode.commands.registerCommand('subsonicPlayer.playPlaylistSongNext', async (playlistIdOrItem: string | any, index?: number) => {
      const args = getPlaylistSongArgs(playlistIdOrItem, index);
      if (!args) { return; }
      const song = args.song ?? (await playlistProvider.getSongs(args.playlistId))[args.index];
      if (song) { queueSongs([song], 'playNext', song.title); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.addPlaylistSongToQueue', async (playlistIdOrItem: string | any, index?: number) => {
      const args = getPlaylistSongArgs(playlistIdOrItem, index);
      if (!args) { return; }
      const song = args.song ?? (await playlistProvider.getSongs(args.playlistId))[args.index];
      if (song) { queueSongs([song], 'addToQueue', song.title); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.playSingleSong', (songInput: Song | { song?: Song }) => {
      const song = getSong(songInput);
      if (song) { queueSongs([song], 'playNow', song.title); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.playSongNext', (songInput: Song | { song?: Song }) => {
      const song = getSong(songInput);
      if (song) { queueSongs([song], 'playNext', song.title); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.addSongToQueue', (songInput: Song | { song?: Song }) => {
      const song = getSong(songInput);
      if (song) { queueSongs([song], 'addToQueue', song.title); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.toggleFavoriteSong', async (songInput: Song | { song?: Song }) => {
      await toggleFavoriteSong(songInput);
    }),

    vscode.commands.registerCommand('subsonicPlayer.playFromQueue', (indexOrItem: number | QueueItem) => {
      const index = getQueueIndex(indexOrItem);
      if (index == null) { return; }
      queueProvider.setCurrentIndex(index);
      const song = queueProvider.getCurrentSong();
      if (song) { playSong(song); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.removeFromQueue', (indexOrItem: number | QueueItem) => {
      const index = getQueueIndex(indexOrItem);
      if (index == null) { return; }
      const result = queueProvider.removeAt(index);
      if (!result.removed) { return; }

      if (result.removedCurrent) {
        const nextSong = queueProvider.getCurrentSong();
        if (nextSong) {
          playSong(nextSong);
        } else {
          resetPlayerState();
        }
      }

      showQueuedMessage('Removed', [result.removed], result.removed.title);
    }),

    vscode.commands.registerCommand('subsonicPlayer.moveQueueItemUp', (indexOrItem: number | QueueItem) => {
      const index = getQueueIndex(indexOrItem);
      if (index != null) { queueProvider.move(index, -1); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.moveQueueItemDown', (indexOrItem: number | QueueItem) => {
      const index = getQueueIndex(indexOrItem);
      if (index != null) { queueProvider.move(index, 1); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.search', async () => {
      const query = await vscode.window.showInputBox({
        placeHolder: 'Search for artists, albums, or songs...',
        prompt: 'Search your music library',
      });
      if (!query) { return; }

      const results = await client.search(query);
      type SearchPick = vscode.QuickPickItem & { song?: Song; album?: Album };
      const items: SearchPick[] = [];

      for (const song of results.songs) {
        items.push({
          label: `$(play) ${song.title}`,
          description: `${song.artist} - ${song.album}`,
          detail: 'Song',
          song,
        });
      }
      for (const album of results.albums) {
        items.push({
          label: `$(library) ${album.name}`,
          description: album.artist,
          detail: 'Album',
          album,
        });
      }

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: `Found ${results.songs.length} songs, ${results.albums.length} albums`,
      });

      if (!picked) { return; }

      const action = await vscode.window.showQuickPick(
        [
          { label: '$(play) Play Now', action: 'playNow' as QueueAction },
          { label: '$(debug-step-over) Play Next', action: 'playNext' as QueueAction },
          { label: '$(list-unordered) Add to Queue', action: 'addToQueue' as QueueAction },
        ],
        { placeHolder: picked.label.replace(/\$\([^)]+\)\s*/, '') },
      );
      if (!action) { return; }

      if (picked.song) {
        const songs = action.action === 'playNow' ? results.songs : [picked.song];
        const startIndex = action.action === 'playNow' ? results.songs.indexOf(picked.song) : 0;
        queueSongs(songs, action.action, picked.song.title, startIndex);
      } else if (picked.album) {
        const result = await getAlbumSongs(picked.album);
        queueSongs(result.songs, action.action, result.album?.name);
      }
    }),

    vscode.commands.registerCommand('subsonicPlayer.playRandom', async () => {
      const songs = await client.getRandomSongs(50);
      queueSongs(songs, 'playNow', 'Random songs');
    }),

    vscode.commands.registerCommand('subsonicPlayer.refresh', () => {
      refreshMusicViews();
    }),

    vscode.commands.registerCommand('subsonicPlayer.clearQueue', () => {
      queueProvider.clear();
      resetPlayerState();
      vscode.window.setStatusBarMessage('Subsonic Player: Queue cleared', 2000);
    }),
  );

  // Test connection on startup if a server is configured
  if (creds?.serverUrl) {
    client.ping().then((ok) => {
      if (ok) {
        vscode.window.setStatusBarMessage('Subsonic Player: Connected', 3000);
      } else {
        vscode.window.showWarningMessage('Subsonic Player: Could not connect to server. Check settings.');
      }
    });
  } else if (serverManager.getServers().length === 0) {
    // No servers at all — prompt to add one
    const action = await vscode.window.showInformationMessage(
      'Subsonic Player: No server configured.', 'Add Server',
    );
    if (action) {
      serverManager.promptAddServer();
    }
  }
}

export function deactivate() {
  AlbumPanel.currentPanel?.dispose();
  PlayerPanel.currentPanel?.dispose();
  PlaylistPanel.currentPanel?.dispose();
}
