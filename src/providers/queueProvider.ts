import * as vscode from 'vscode';
import { Song } from '../api/subsonic';

export class QueueItem extends vscode.TreeItem {
  constructor(public readonly song: Song, public readonly index: number, public readonly isPlaying: boolean) {
    super(song.title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'queueItem';
    this.iconPath = new vscode.ThemeIcon(isPlaying ? 'play' : song.starred ? 'star-full' : 'circle-outline');
    this.description = `${song.artist} - ${song.album}`;
    this.tooltip = `${song.title}\n${song.artist} - ${song.album}${song.starred ? '\nFavorite track' : ''}`;
    this.command = {
      command: 'subsonicPlayer.playFromQueue',
      title: 'Play',
      arguments: [index],
    };
  }
}

export class QueueProvider implements vscode.TreeDataProvider<QueueItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<QueueItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private queue: Song[] = [];
  private currentIndex: number = -1;

  getQueue(): Song[] { return this.queue; }
  getCurrentIndex(): number { return this.currentIndex; }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  setQueue(songs: Song[], startIndex: number = 0) {
    this.queue = [...songs];
    this.currentIndex = this.queue.length > 0 ? Math.min(Math.max(startIndex, 0), this.queue.length - 1) : -1;
    this._onDidChangeTreeData.fire(undefined);
  }

  setCurrentIndex(index: number) {
    if (index < 0 || index >= this.queue.length) { return; }
    this.currentIndex = index;
    this._onDidChangeTreeData.fire(undefined);
  }

  append(songs: Song[]): number {
    const startIndex = this.queue.length;
    this.queue.push(...songs);
    this._onDidChangeTreeData.fire(undefined);
    return startIndex;
  }

  insertNext(songs: Song[]): number {
    if (this.currentIndex < 0) {
      this.queue.unshift(...songs);
      this._onDidChangeTreeData.fire(undefined);
      return 0;
    }

    const startIndex = this.currentIndex + 1;
    this.queue.splice(startIndex, 0, ...songs);
    this._onDidChangeTreeData.fire(undefined);
    return startIndex;
  }

  removeAt(index: number): { removed?: Song; removedCurrent: boolean } {
    if (index < 0 || index >= this.queue.length) {
      return { removedCurrent: false };
    }

    const removedCurrent = index === this.currentIndex;
    const [removed] = this.queue.splice(index, 1);

    if (this.queue.length === 0) {
      this.currentIndex = -1;
    } else if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (removedCurrent && this.currentIndex >= this.queue.length) {
      this.currentIndex = this.queue.length - 1;
    }

    this._onDidChangeTreeData.fire(undefined);
    return { removed, removedCurrent };
  }

  move(index: number, delta: -1 | 1): number | undefined {
    const targetIndex = index + delta;
    if (index < 0 || index >= this.queue.length || targetIndex < 0 || targetIndex >= this.queue.length) {
      return undefined;
    }

    const [song] = this.queue.splice(index, 1);
    this.queue.splice(targetIndex, 0, song);

    if (this.currentIndex === index) {
      this.currentIndex = targetIndex;
    } else if (this.currentIndex === targetIndex) {
      this.currentIndex = index;
    }

    this._onDidChangeTreeData.fire(undefined);
    return targetIndex;
  }

  getCurrentSong(): Song | undefined {
    return this.queue[this.currentIndex];
  }

  next(shuffle: boolean = false, repeatAll: boolean = false): Song | undefined {
    if (this.queue.length === 0) { return undefined; }

    if (shuffle) {
      // Pick a random index different from current (if possible)
      if (this.queue.length === 1) {
        this.currentIndex = 0;
      } else {
        let idx;
        do { idx = Math.floor(Math.random() * this.queue.length); }
        while (idx === this.currentIndex);
        this.currentIndex = idx;
      }
      this._onDidChangeTreeData.fire(undefined);
      return this.queue[this.currentIndex];
    }

    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      this._onDidChangeTreeData.fire(undefined);
      return this.queue[this.currentIndex];
    }

    if (repeatAll) {
      this.currentIndex = 0;
      this._onDidChangeTreeData.fire(undefined);
      return this.queue[this.currentIndex];
    }

    return undefined;
  }

  previous(): Song | undefined {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this._onDidChangeTreeData.fire(undefined);
      return this.queue[this.currentIndex];
    }
    return undefined;
  }

  clear() {
    this.queue = [];
    this.currentIndex = -1;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: QueueItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<QueueItem[]> {
    return this.queue.map((song, i) => new QueueItem(song, i, i === this.currentIndex));
  }
}
