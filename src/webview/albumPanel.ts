import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { Album, Song } from '../api/subsonic';

export class AlbumPanel {
  public static currentPanel: AlbumPanel | undefined;
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

    if (AlbumPanel.currentPanel) {
      AlbumPanel.currentPanel._panel.reveal(column);
      AlbumPanel.currentPanel._onCommand = onCommand;
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'subsonicAlbum',
      'Album',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    AlbumPanel.currentPanel = new AlbumPanel(panel, onCommand);
  }

  showAlbum(album: Album, songs: Song[], coverUrl: string) {
    this._panel.title = album.name;
    this._panel.webview.html = this._getHtml(album, songs, coverUrl);
  }

  dispose() {
    AlbumPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  private _getHtml(album: Album, songs: Song[], coverUrl: string): string {
    const nonce = getNonce();
    const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalMins = Math.floor(totalDuration / 60);
    const totalHrs = Math.floor(totalMins / 60);
    const remainMins = totalMins % 60;
    const durationStr = totalHrs > 0 ? `${totalHrs}h ${remainMins}m` : `${totalMins}m`;
    const year = album.year ? ` &middot; ${album.year}` : '';
    const genre = album.genre ? ` &middot; ${this._esc(album.genre)}` : '';
    const favoriteLabel = album.starred ? '&#9733; Favorited' : '&#9734; Favorite';

    const songRows = songs.map((song, i) => {
      const mins = Math.floor(song.duration / 60);
      const secs = song.duration % 60;
      const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      const trackNo = song.track ?? i + 1;
      const favoriteIcon = song.starred ? '&#9733;' : '&#9734;';

      return `<tr class="song-row" data-index="${i}">
        <td class="col-track">${trackNo}</td>
        <td class="col-info">
          <div class="song-title">${this._esc(song.title)}</div>
          <div class="song-meta">${this._esc(song.artist)}</div>
        </td>
        <td class="col-duration">${timeStr}</td>
        <td class="col-bitrate">${song.bitRate ? song.bitRate + ' kbps' : ''}</td>
        <td class="col-format">${this._esc(song.suffix || '')}</td>
        <td class="col-action"><button class="icon-btn favorite-track-btn" data-index="${i}" title="Toggle favorite">${favoriteIcon}</button></td>
      </tr>`;
    }).join('\n');

    const coverHtml = coverUrl
      ? `<img src="${this._esc(coverUrl)}" alt="" />`
      : '&#9835;';

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this._panel.webview.cspSource} http: https: data:; style-src ${this._panel.webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
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
      width: 120px;
      height: 120px;
      border-radius: 8px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 44px;
      opacity: 0.9;
      overflow: hidden;
      flex-shrink: 0;
    }
    .header-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .header-info { flex: 1; min-width: 0; }
    .eyebrow {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.5;
      margin-bottom: 6px;
    }
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
      opacity: 0.65;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
      flex-shrink: 0;
    }
    .album-action-btn, .icon-btn {
      border: none;
      cursor: pointer;
      white-space: nowrap;
      font-family: var(--vscode-font-family);
    }
    .album-action-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      padding: 8px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }
    .album-action-btn.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .album-action-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .album-action-btn.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .table-wrapper { overflow-x: auto; }
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
      padding: 9px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, transparent);
      vertical-align: middle;
    }
    .col-track {
      width: 52px;
      text-align: center;
      opacity: 0.45;
      font-variant-numeric: tabular-nums;
    }
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
    .col-duration, .col-bitrate, .col-format {
      white-space: nowrap;
      opacity: 0.6;
      font-size: 12px;
    }
    .col-duration {
      font-variant-numeric: tabular-nums;
    }
    .col-action {
      width: 48px;
      text-align: right;
    }
    .icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: transparent;
      color: var(--vscode-foreground);
      font-size: 15px;
    }
    .icon-btn:hover {
      background: var(--vscode-toolbar-hoverBackground);
      color: var(--vscode-button-background);
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
    <div class="header-cover">${coverHtml}</div>
    <div class="header-info">
      <div class="eyebrow">Album</div>
      <h1>${this._esc(album.name)}</h1>
      <div class="header-meta">${this._esc(album.artist)}${year}${genre} &middot; ${songs.length} songs &middot; ${durationStr}</div>
    </div>
    <div class="header-actions">
      <button class="album-action-btn" id="playAllBtn">&#9654; Play All</button>
      <button class="album-action-btn secondary" id="playNextBtn">Play Next</button>
      <button class="album-action-btn secondary" id="addQueueBtn">Add to Queue</button>
      <button class="album-action-btn secondary" id="favoriteAlbumBtn">${favoriteLabel}</button>
    </div>
  </div>

  <div class="table-wrapper">
  ${songs.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Title</th>
          <th>Duration</th>
          <th>Bitrate</th>
          <th>Format</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${songRows}
      </tbody>
    </table>
  ` : '<div class="empty">This album has no songs</div>'}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('playAllBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'playAll' });
    });
    document.getElementById('playNextBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'playNext' });
    });
    document.getElementById('addQueueBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'addToQueue' });
    });
    document.getElementById('favoriteAlbumBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'toggleFavoriteAlbum' });
    });

    document.querySelectorAll('.song-row').forEach(row => {
      row.addEventListener('click', () => {
        const index = parseInt(row.dataset.index, 10);
        vscode.postMessage({ command: 'playSong', data: { index } });
      });
    });

    document.querySelectorAll('.favorite-track-btn').forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const index = parseInt(button.dataset.index, 10);
        vscode.postMessage({ command: 'toggleFavoriteSong', data: { index } });
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

function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
