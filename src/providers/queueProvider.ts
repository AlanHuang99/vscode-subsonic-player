import * as vscode from 'vscode';
import { Song } from '../api/subsonic';

class QueueItem extends vscode.TreeItem {
  constructor(public readonly song: Song, public readonly index: number, public readonly isPlaying: boolean) {
    super(song.title, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'queueItem';
    this.iconPath = new vscode.ThemeIcon(isPlaying ? 'play' : 'circle-outline');
    this.description = `${song.artist} - ${song.album}`;
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

  setQueue(songs: Song[], startIndex: number = 0) {
    this.queue = songs;
    this.currentIndex = startIndex;
    this._onDidChangeTreeData.fire(undefined);
  }

  setCurrentIndex(index: number) {
    this.currentIndex = index;
    this._onDidChangeTreeData.fire(undefined);
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
