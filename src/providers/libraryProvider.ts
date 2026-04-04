import * as vscode from 'vscode';
import { SubsonicClient, Artist, Album } from '../api/subsonic';

type TreeItem = ArtistItem | AlbumItem | CategoryItem;

class CategoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly category: 'artists' | 'recent' | 'random' | 'frequent',
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'category';
    this.iconPath = new vscode.ThemeIcon(
      category === 'artists' ? 'person' :
      category === 'recent' ? 'history' :
      category === 'random' ? 'sparkle' : 'flame'
    );
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
    this.iconPath = new vscode.ThemeIcon('library');
    this.description = `${album.artist} (${album.year || '?'})`;
    this.tooltip = `${album.name} - ${album.artist}\n${album.songCount} songs`;
    this.command = {
      command: 'subsonicPlayer.playAlbum',
      title: 'Play Album',
      arguments: [album],
    };
  }
}

export class LibraryProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private client: SubsonicClient) {}

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      return [
        new CategoryItem('Recent Albums', 'recent'),
        new CategoryItem('Random Albums', 'random'),
        new CategoryItem('Most Played', 'frequent'),
        new CategoryItem('All Artists', 'artists'),
      ];
    }

    if (element instanceof CategoryItem) {
      switch (element.category) {
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
      }
    }

    if (element instanceof ArtistItem) {
      const { albums } = await this.client.getArtist(element.artist.id);
      return albums.map(a => new AlbumItem(a));
    }

    return [];
  }
}
