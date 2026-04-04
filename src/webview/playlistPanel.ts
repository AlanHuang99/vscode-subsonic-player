import * as vscode from 'vscode';
import { Playlist, Song } from '../api/subsonic';

export class PlaylistPanel {
  public static currentPanel: PlaylistPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _onCommand: (command: string, data?: any) => void;

  private constructor(
    panel: vscode.WebviewPanel,
    onCommand: (command: string, data?: any) => void,
  ) {
    this._panel = panel;
    this._onCommand = onCommand;

    this._panel.webview.onDidReceiveMessage(
      (message) => this._onCommand(message.command, message.data),
      null,
      this._disposables,
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  static createOrShow(onCommand: (command: string, data?: any) => void) {
    const column = vscode.ViewColumn.One;

    if (PlaylistPanel.currentPanel) {
      PlaylistPanel.currentPanel._panel.reveal(column);
      PlaylistPanel.currentPanel._onCommand = onCommand;
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'subsonicPlaylist',
      'Playlist',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    PlaylistPanel.currentPanel = new PlaylistPanel(panel, onCommand);
  }

  showPlaylist(playlist: Playlist, songs: Song[], coverUrls: Map<string, string>) {
    this._panel.title = playlist.name;
    this._panel.webview.html = this._getHtml(playlist, songs, coverUrls);
  }

  dispose() {
    PlaylistPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  private _getHtml(playlist: Playlist, songs: Song[], coverUrls: Map<string, string>): string {
    const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalMins = Math.floor(totalDuration / 60);
    const totalHrs = Math.floor(totalMins / 60);
    const remainMins = totalMins % 60;
    const durationStr = totalHrs > 0 ? `${totalHrs}h ${remainMins}m` : `${totalMins}m`;
    const smartBadge = playlist.smart ? '<span class="badge smart">Smart</span>' : '';

    const songRows = songs.map((song, i) => {
      const mins = Math.floor(song.duration / 60);
      const secs = song.duration % 60;
      const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      const coverUrl = coverUrls.get(song.id) || '';
      const coverHtml = coverUrl
        ? `<img class="song-cover" src="${coverUrl}" />`
        : `<div class="song-cover no-art">&#9835;</div>`;

      return `<tr class="song-row" data-index="${i}">
        <td class="col-num">${i + 1}</td>
        <td class="col-cover">${coverHtml}</td>
        <td class="col-info">
          <div class="song-title">${this._esc(song.title)}</div>
          <div class="song-meta">${this._esc(song.artist)}</div>
        </td>
        <td class="col-album">${this._esc(song.album)}</td>
        <td class="col-genre">${this._esc(song.genre || '')}</td>
        <td class="col-year">${song.year || ''}</td>
        <td class="col-duration">${timeStr}</td>
        <td class="col-bitrate">${song.bitRate ? song.bitRate + ' kbps' : ''}</td>
        <td class="col-format">${this._esc(song.suffix || '')}</td>
      </tr>`;
    }).join('\n');

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 0;
    }
    .header {
      padding: 24px 28px 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBar-background);
    }
    .header-cover {
      width: 100px;
      height: 100px;
      border-radius: 8px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      opacity: 0.3;
      overflow: hidden;
      flex-shrink: 0;
    }
    .header-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .header-info { flex: 1; min-width: 0; }
    .header-info h1 {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header-meta {
      font-size: 13px;
      opacity: 0.6;
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: 8px;
      vertical-align: middle;
    }
    .badge.smart {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .play-all-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 20px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .play-all-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .table-wrapper {
      overflow-x: auto;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead th {
      text-align: left;
      padding: 10px 12px;
      font-weight: 500;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.5;
      border-bottom: 1px solid var(--vscode-panel-border);
      position: sticky;
      top: 0;
      background: var(--vscode-editor-background);
      z-index: 1;
    }
    tbody tr {
      cursor: pointer;
      transition: background 0.1s;
    }
    tbody tr:hover {
      background: var(--vscode-list-hoverBackground);
    }
    tbody td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, transparent);
      vertical-align: middle;
    }
    .col-num {
      width: 40px;
      text-align: center;
      opacity: 0.4;
      font-variant-numeric: tabular-nums;
    }
    .col-cover {
      width: 48px;
      min-width: 48px;
      padding: 4px 8px;
    }
    .song-cover {
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      border-radius: 4px;
      object-fit: cover;
      display: block;
      aspect-ratio: 1;
      flex-shrink: 0;
    }
    .song-cover.no-art {
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      opacity: 0.3;
    }
    .col-info { min-width: 150px; }
    .song-title {
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .song-meta {
      font-size: 12px;
      opacity: 0.6;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .col-album {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.7;
    }
    .col-genre, .col-year, .col-bitrate, .col-format {
      white-space: nowrap;
      opacity: 0.5;
      font-size: 12px;
    }
    .col-duration {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      opacity: 0.6;
    }
    .empty {
      text-align: center;
      padding: 60px 20px;
      opacity: 0.4;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-cover">&#9835;</div>
    <div class="header-info">
      <h1>${this._esc(playlist.name)}${smartBadge}</h1>
      <div class="header-meta">${songs.length} songs &middot; ${durationStr}${playlist.comment ? ' &middot; ' + this._esc(playlist.comment) : ''}</div>
    </div>
    <button class="play-all-btn" id="playAllBtn">&#9654; Play All</button>
  </div>

  <div class="table-wrapper">
  ${songs.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th></th>
          <th>Title</th>
          <th>Album</th>
          <th>Genre</th>
          <th>Year</th>
          <th>Duration</th>
          <th>Bitrate</th>
          <th>Format</th>
        </tr>
      </thead>
      <tbody>
        ${songRows}
      </tbody>
    </table>
  ` : '<div class="empty">This playlist has no songs</div>'}
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('playAllBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'playAll' });
    });

    document.querySelectorAll('.song-row').forEach(row => {
      row.addEventListener('click', () => {
        const index = parseInt(row.dataset.index, 10);
        vscode.postMessage({ command: 'playSong', data: { index } });
      });
    });
  </script>
</body>
</html>`;
  }

  private _esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
