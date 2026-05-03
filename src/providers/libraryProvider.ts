import * as vscode from 'vscode';
import { SubsonicClient, Artist, Album, Song } from '../api/subsonic';

type TreeItem = ArtistItem | AlbumItem | SongItem | NowPlayingItem | PlaceholderItem | CategoryItem;

class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly category: 'nowPlaying' | 'artists' | 'recent' | 'random' | 'frequent' | 'starred',
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'category';
    this.iconPath = new vscode.ThemeIcon(
      category === 'artists' ? 'person' :
      category === 'nowPlaying' ? 'play-circle' :
      category === 'recent' ? 'history' :
      category === 'random' ? 'sparkle' :
      category === 'starred' ? 'star-full' : 'flame'
    );
  }
}

class PlaceholderItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'placeholder';
    this.iconPath = new vscode.ThemeIcon('circle-outline');
  }
}

class ArtistItem extends vscode.TreeItem {
  constructor(public readonly artist: Artist) {
    super(artist.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'artist';
    this.iconPath = new vscode.ThemeIcon('person');
    this.tooltip = `${artist.name} (${artist.albumCount || 0} albums)`;
  }
}

class AlbumItem extends vscode.TreeItem {
  constructor(public readonly album: Album) {
    super(album.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'album';
    this.iconPath = new vscode.ThemeIcon(album.starred ? 'star-full' : 'library');
    this.description = `${album.artist} (${album.year || '?'})`;
    this.tooltip = `${album.name} - ${album.artist}\n${album.songCount} songs${album.starred ? '\nFavorite album' : ''}`;
    this.command = {
      command: 'subsonicPlayer.showAlbum',
      title: 'Open Album',
      arguments: [album],
    };
  }
}

class SongItem extends vscode.TreeItem {
  constructor(public readonly song: Song) {
    super(song.title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'song';
    this.iconPath = new vscode.ThemeIcon(song.starred ? 'star-full' : 'music');
    this.description = `${song.artist} - ${song.album}`;
    const mins = Math.floor(song.duration / 60);
    const secs = song.duration % 60;
    this.tooltip = `${song.title}\n${song.artist} - ${song.album}\n${mins}:${secs < 10 ? '0' : ''}${secs}${song.starred ? '\nFavorite track' : ''}`;
    this.command = {
      command: 'subsonicPlayer.playSingleSong',
      title: 'Play Song',
      arguments: [song],
    };
  }
}

class NowPlayingItem extends vscode.TreeItem {
  constructor(public readonly song: Song) {
    super(song.title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'nowPlayingSong';
    this.iconPath = new vscode.ThemeIcon(song.starred ? 'star-full' : 'play');
    this.description = `${song.artist} - ${song.album}`;
    this.tooltip = `Now playing\n${song.title}\n${song.artist} - ${song.album}${song.starred ? '\nFavorite track' : ''}`;
    this.command = {
      command: 'subsonicPlayer.openPlayer',
      title: 'Open Music Player',
    };
  }
}

export class LibraryProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private nowPlaying: Song | undefined;

  constructor(private client: SubsonicClient) {}

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  setNowPlaying(song: Song | undefined) {
    this.nowPlaying = song;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      return [
        new CategoryItem('Now Playing', 'nowPlaying'),
        new CategoryItem('Favorite Songs', 'starred'),
        new CategoryItem('Recent Albums', 'recent'),
        new CategoryItem('Random Albums', 'random'),
        new CategoryItem('Most Played', 'frequent'),
        new CategoryItem('All Artists', 'artists'),
      ];
    }

    if (element instanceof CategoryItem) {
      switch (element.category) {
        case 'nowPlaying':
          return this.nowPlaying
            ? [new NowPlayingItem(this.nowPlaying)]
            : [new PlaceholderItem('No track playing')];
        case 'artists': {
          const artists = await this.client.getArtists();
          return artists.map(a => new ArtistItem(a));
        }
        case 'recent': {
          const albums = await this.client.getAlbumList('recent', 30);
          return albums.map(a => new AlbumItem(a));
        }
        case 'random': {
          const albums = await this.client.getAlbumList('random', 30);
          return albums.map(a => new AlbumItem(a));
        }
        case 'frequent': {
          const albums = await this.client.getAlbumList('frequent', 30);
          return albums.map(a => new AlbumItem(a));
        }
        case 'starred': {
          const starred = await this.client.getStarred();
          return starred.songs.map(s => new SongItem(s));
        }
      }
    }

    if (element instanceof ArtistItem) {
      const { albums } = await this.client.getArtist(element.artist.id);
      return albums.map(a => new AlbumItem(a));
    }

    return [];
  }
}
