import * as vscode from 'vscode';
import { SubsonicClient, Song, Album, Playlist } from './api/subsonic';
import { LibraryProvider } from './providers/libraryProvider';
import { PlaylistProvider } from './providers/playlistProvider';
import { QueueProvider } from './providers/queueProvider';
import { PlayerPanel } from './webview/playerPanel';
import { PlaylistPanel } from './webview/playlistPanel';
import { ServerManager } from './serverManager';

let client: SubsonicClient;
let statusBarItem: vscode.StatusBarItem;
let serverStatusBarItem: vscode.StatusBarItem;
let serverManager: ServerManager;

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

  vscode.window.registerTreeDataProvider('subsonicPlayer.library', libraryProvider);
  vscode.window.registerTreeDataProvider('subsonicPlayer.playlists', playlistProvider);
  vscode.window.registerTreeDataProvider('subsonicPlayer.queue', queueProvider);

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
  serverManager.onDidChange(() => reconnect());

  function playSong(song: Song) {
    const streamUrl = client.getStreamUrl(song.id);
    const coverUrl = song.coverArt ? client.getCoverArtUrl(song.coverArt) : '';

    function sendTrackAndLyrics() {
      PlayerPanel.currentPanel?.updateTrack(song, streamUrl, coverUrl);
      client.getLyrics(song.id).then((lyrics) => {
        if (lyrics.length > 0) {
          PlayerPanel.currentPanel?.updateLyrics(lyrics);
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
        const shuffle = data?.shuffleOn ?? false;
        const repeatAll = data?.repeatMode === 1;
        const next = queueProvider.next(shuffle, repeatAll);
        if (next) { playSong(next); }
        break;
      }
      case 'previous': {
        const prev = queueProvider.previous();
        if (prev) { playSong(prev); }
        break;
      }
      case 'shuffle':
      case 'repeat':
        // State is tracked in webview; these are informational
        break;
    }
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
        PlayerPanel.currentPanel.updateState({ isPlaying: true });
        PlayerPanel.currentPanel['_panel'].webview.postMessage({ type: 'playPause' });
      } else {
        PlayerPanel.createOrShow(context.extensionUri, handlePanelCommand);
      }
    }),

    vscode.commands.registerCommand('subsonicPlayer.next', () => {
      const next = queueProvider.next();
      if (next) { playSong(next); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.previous', () => {
      const prev = queueProvider.previous();
      if (prev) { playSong(prev); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.playAlbum', async (album: Album) => {
      const { songs } = await client.getAlbum(album.id);
      queueProvider.setQueue(songs, 0);
      if (songs.length > 0) {
        playSong(songs[0]);
      }
    }),

    vscode.commands.registerCommand('subsonicPlayer.showPlaylist', async (playlist: Playlist) => {
      const songs = await playlistProvider.getSongs(playlist.id);
      const coverUrls = new Map<string, string>();
      for (const song of songs) {
        if (song.coverArt) {
          coverUrls.set(song.id, client.getCoverArtUrl(song.coverArt, '64'));
        }
      }

      const currentPlaylistSongs = songs;

      PlaylistPanel.createOrShow((command, data) => {
        switch (command) {
          case 'playAll':
            queueProvider.setQueue(currentPlaylistSongs, 0);
            if (currentPlaylistSongs.length > 0) {
              playSong(currentPlaylistSongs[0]);
            }
            break;
          case 'playSong':
            if (data?.index != null) {
              queueProvider.setQueue(currentPlaylistSongs, data.index);
              playSong(currentPlaylistSongs[data.index]);
            }
            break;
        }
      });

      setTimeout(() => {
        PlaylistPanel.currentPanel?.showPlaylist(playlist, songs, coverUrls);
      }, 100);
    }),

    vscode.commands.registerCommand('subsonicPlayer.playPlaylist', async (playlist: Playlist) => {
      const songs = await playlistProvider.getSongs(playlist.id);
      queueProvider.setQueue(songs, 0);
      if (songs.length > 0) {
        playSong(songs[0]);
      }
    }),

    vscode.commands.registerCommand('subsonicPlayer.playFromPlaylist', async (playlistId: string, index: number) => {
      const songs = await playlistProvider.getSongs(playlistId);
      queueProvider.setQueue(songs, index);
      if (songs[index]) {
        playSong(songs[index]);
      }
    }),

    vscode.commands.registerCommand('subsonicPlayer.playFromQueue', (index: number) => {
      queueProvider.setCurrentIndex(index);
      const song = queueProvider.getCurrentSong();
      if (song) { playSong(song); }
    }),

    vscode.commands.registerCommand('subsonicPlayer.search', async () => {
      const query = await vscode.window.showInputBox({
        placeHolder: 'Search for artists, albums, or songs...',
        prompt: 'Search your music library',
      });
      if (!query) { return; }

      const results = await client.search(query);
      const items: vscode.QuickPickItem[] = [];

      for (const song of results.songs) {
        items.push({
          label: `$(play) ${song.title}`,
          description: `${song.artist} - ${song.album}`,
          detail: 'Song',
        });
      }
      for (const album of results.albums) {
        items.push({
          label: `$(library) ${album.name}`,
          description: album.artist,
          detail: 'Album',
        });
      }

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: `Found ${results.songs.length} songs, ${results.albums.length} albums`,
      });

      if (!picked) { return; }

      if (picked.detail === 'Song') {
        const song = results.songs.find(s => picked.label.includes(s.title));
        if (song) {
          queueProvider.setQueue(results.songs, results.songs.indexOf(song));
          playSong(song);
        }
      } else if (picked.detail === 'Album') {
        const album = results.albums.find(a => picked.label.includes(a.name));
        if (album) {
          vscode.commands.executeCommand('subsonicPlayer.playAlbum', album);
        }
      }
    }),

    vscode.commands.registerCommand('subsonicPlayer.playRandom', async () => {
      const songs = await client.getRandomSongs(50);
      queueProvider.setQueue(songs, 0);
      if (songs.length > 0) {
        playSong(songs[0]);
      }
    }),

    vscode.commands.registerCommand('subsonicPlayer.refresh', () => {
      libraryProvider.refresh();
      playlistProvider.refresh();
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
  PlayerPanel.currentPanel?.dispose();
  PlaylistPanel.currentPanel?.dispose();
}
