import * as vscode from 'vscode';
import { SubsonicClient, Playlist, Song } from '../api/subsonic';

type PlaylistTreeItem = PlaylistItem | PlaylistSongItem;

class PlaylistItem extends vscode.TreeItem {
  constructor(public readonly playlist: Playlist) {
    super(playlist.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'playlist';
    this.iconPath = new vscode.ThemeIcon(playlist.smart ? 'wand' : 'list-unordered');
    const smartLabel = playlist.smart ? ' (Smart)' : '';
    this.description = `${playlist.songCount} songs${smartLabel}`;
    this.tooltip = `${playlist.name}${smartLabel}\n${playlist.songCount} songs`;
    if (playlist.comment) {
      this.tooltip += `\n${playlist.comment}`;
    }
    // Click opens detail view instead of playing
    this.command = {
      command: 'subsonicPlayer.showPlaylist',
      title: 'Show Playlist',
      arguments: [playlist],
    };
  }
}

class PlaylistSongItem extends vscode.TreeItem {
  constructor(
    public readonly song: Song,
    public readonly playlistId: string,
    public readonly index: number,
  ) {
    super(song.title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'playlistSong';
    this.iconPath = new vscode.ThemeIcon('play');
    this.description = `${song.artist} — ${song.album}`;
    const mins = Math.floor(song.duration / 60);
    const secs = song.duration % 60;
    this.tooltip = `${song.title}\n${song.artist} — ${song.album}\n${mins}:${secs < 10 ? '0' : ''}${secs}`;
    this.command = {
      command: 'subsonicPlayer.playFromPlaylist',
      title: 'Play',
      arguments: [playlistId, index],
    };
  }
}

export class PlaylistProvider implements vscode.TreeDataProvider<PlaylistTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PlaylistTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private playlistCache = new Map<string, Song[]>();

  constructor(private client: SubsonicClient) {}

  refresh() {
    this.playlistCache.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: PlaylistTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PlaylistTreeItem): Promise<PlaylistTreeItem[]> {
    if (!element) {
      try {
        const playlists = await this.client.getAllPlaylists();
        return playlists.map(p => new PlaylistItem(p));
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to load playlists: ${err.message}`);
        return [];
      }
    }

    if (element instanceof PlaylistItem) {
      const id = element.playlist.id;
      let songs = this.playlistCache.get(id);
      if (!songs) {
        const result = await this.client.getPlaylist(id);
        songs = result.songs;
        this.playlistCache.set(id, songs);
      }
      return songs.map((s, i) => new PlaylistSongItem(s, id, i));
    }

    return [];
  }

  async getSongs(playlistId: string): Promise<Song[]> {
    let songs = this.playlistCache.get(playlistId);
    if (!songs) {
      const result = await this.client.getPlaylist(playlistId);
      songs = result.songs;
      this.playlistCache.set(playlistId, songs);
    }
    return songs;
  }
}
