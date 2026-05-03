import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { Song, StructuredLyric } from '../api/subsonic';

export class PlayerPanel {
  public static currentPanel: PlayerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _onCommand: (command: string, data?: any) => void;

  private constructor(
    panel: vscode.WebviewPanel,
    private extensionUri: vscode.Uri,
    onCommand: (command: string, data?: any) => void,
  ) {
    this._panel = panel;
    this._onCommand = onCommand;

    this._panel.webview.html = this._getHtml();

    this._panel.webview.onDidReceiveMessage(
      (message) => this._onCommand(message.command, message.data),
      null,
      this._disposables,
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  static createOrShow(extensionUri: vscode.Uri, onCommand: (command: string, data?: any) => void) {
    const column = vscode.ViewColumn.Beside;

    if (PlayerPanel.currentPanel) {
      PlayerPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'subsonicPlayer',
      'Music Player',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      },
    );

    PlayerPanel.currentPanel = new PlayerPanel(panel, extensionUri, onCommand);
  }

  updateTrack(song: Song, streamUrl: string, coverUrl: string) {
    this._panel.webview.postMessage({
      type: 'track',
      song,
      streamUrl,
      coverUrl,
    });
  }

  updateLyrics(songId: string, lyrics: StructuredLyric[]) {
    this._panel.webview.postMessage({ type: 'lyrics', songId, lyrics });
  }

  updateState(state: { isPlaying: boolean; position?: number; duration?: number }) {
    this._panel.webview.postMessage({ type: 'state', ...state });
  }

  togglePlayPause() {
    this._panel.webview.postMessage({ type: 'playPause' });
  }

  stopPlayback() {
    this._panel.webview.postMessage({ type: 'stop' });
  }

  dispose() {
    PlayerPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) { d.dispose(); }
    }
  }

  private _getHtml(): string {
    const nonce = getNonce();

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this._panel.webview.cspSource} http: https: data:; media-src http: https:; style-src ${this._panel.webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      min-height: 100vh;
    }
    .player-container {
      max-width: 400px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .cover-art {
      width: min(300px, 100%);
      aspect-ratio: 1;
      border-radius: 12px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      flex-shrink: 0;
    }
    .cover-art img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: auto;
    }
    .no-cover {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 64px;
      opacity: 0.3;
    }
    .track-info {
      text-align: center;
      width: 100%;
    }
    .track-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .track-artist {
      font-size: 14px;
      opacity: 0.7;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .track-album {
      font-size: 12px;
      opacity: 0.5;
      margin-top: 2px;
    }
    .progress-container {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .progress-bar {
      flex: 1;
      height: 4px;
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 2px;
      cursor: pointer;
      position: relative;
    }
    .progress-bar:hover { height: 6px; }
    .progress-fill {
      height: 100%;
      background: var(--vscode-button-background);
      border-radius: 2px;
      width: 0%;
      transition: width 0.2s linear;
    }
    .time {
      font-size: 11px;
      opacity: 0.6;
      min-width: 40px;
      font-variant-numeric: tabular-nums;
    }
    .time-left { text-align: right; }
    .controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .controls button {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .controls button:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }
    .controls button.active {
      color: var(--vscode-button-background);
    }
    .controls button.active::after {
      content: '';
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--vscode-button-background);
    }
    .controls button {
      position: relative;
    }
    #repeatBtn .repeat-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      font-size: 8px;
      font-weight: 700;
      color: var(--vscode-button-background);
      display: none;
    }
    #repeatBtn.active .repeat-badge {
      display: block;
    }
    .controls button svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .play-btn svg { width: 32px; height: 32px; }
    .play-btn {
      background: var(--vscode-button-background) !important;
      color: var(--vscode-button-foreground) !important;
      width: 52px;
      height: 52px;
    }
    .volume-container {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      justify-content: center;
    }
    .volume-container svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: var(--vscode-foreground);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.6;
    }
    .volume-slider {
      width: 100px;
      height: 4px;
      -webkit-appearance: none;
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 2px;
      outline: none;
    }
    .volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--vscode-button-background);
      cursor: pointer;
    }
    .idle-message {
      text-align: center;
      opacity: 0.5;
      margin-top: 40px;
      font-size: 14px;
    }
    .time.clickable {
      cursor: pointer;
      user-select: none;
    }
    .time.clickable:hover {
      opacity: 1;
      color: var(--vscode-button-background);
    }
    .lyrics-container {
      width: 100%;
      max-height: 300px;
      overflow-y: auto;
      margin-top: 8px;
      scroll-behavior: smooth;
    }
    .lyrics-container::-webkit-scrollbar { width: 4px; }
    .lyrics-container::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 2px;
    }
    .lyrics-line {
      padding: 6px 12px;
      font-size: 13px;
      opacity: 0.4;
      cursor: pointer;
      border-radius: 4px;
      transition: opacity 0.3s, background 0.3s;
      text-align: center;
      line-height: 1.5;
    }
    .lyrics-line:hover {
      opacity: 0.7;
      background: var(--vscode-toolbar-hoverBackground);
    }
    .lyrics-line.active {
      opacity: 1;
      font-weight: 600;
      font-size: 14px;
      color: var(--vscode-button-background);
    }
    .lyrics-line.past {
      opacity: 0.55;
    }
	    .lyrics-empty {
	      text-align: center;
	      opacity: 0.3;
	      padding: 20px;
	      font-size: 13px;
	    }
	    .hidden {
	      display: none !important;
	    }
	    .seek-input {
	      position: fixed;
	      top: 50%;
	      left: 50%;
	      transform: translate(-50%, -50%);
	      background: var(--vscode-input-background);
	      color: var(--vscode-input-foreground);
	      border: 1px solid var(--vscode-input-border);
	      padding: 8px 12px;
	      border-radius: 6px;
	      font-size: 16px;
	      text-align: center;
	      width: 120px;
	      z-index: 9999;
	      outline: none;
	      font-family: var(--vscode-font-family);
	    }
	  </style>
</head>
<body>
	  <div class="player-container">
	    <div class="cover-art">
	      <div class="no-cover" id="noCover">&#9835;</div>
	      <img id="coverImg" class="hidden" alt="" />
	    </div>

    <div class="track-info">
      <div class="track-title" id="title">No track playing</div>
      <div class="track-artist" id="artist">Select a song from the library</div>
      <div class="track-album" id="album"></div>
    </div>

    <div class="progress-container">
      <span class="time time-left clickable" id="currentTime" title="Click to jump to time">0:00</span>
      <div class="progress-bar" id="progressBar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <span class="time clickable" id="totalTime" title="Click to jump to time">0:00</span>
    </div>

    <div class="controls">
      <button id="shuffleBtn" title="Shuffle">
        <svg viewBox="0 0 24 24"><path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-7.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.029a4 4 0 0 1-3.3-1.7l-.372-.519"/></svg>
      </button>
      <button id="prevBtn" title="Previous">
        <svg viewBox="0 0 24 24"><path d="M6 19V5"/><path d="m18 5-8 7 8 7"/></svg>
      </button>
	      <button class="play-btn" id="playBtn" title="Play/Pause">
	        <svg viewBox="0 0 24 24" id="playIcon"><polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/></svg>
	        <svg viewBox="0 0 24 24" id="pauseIcon" class="hidden"><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/></svg>
	      </button>
      <button id="nextBtn" title="Next">
        <svg viewBox="0 0 24 24"><path d="m6 5 8 7-8 7"/><path d="M18 5v14"/></svg>
      </button>
      <button id="repeatBtn" title="Repeat">
        <svg viewBox="0 0 24 24"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
        <span class="repeat-badge" id="repeatBadge"></span>
      </button>
    </div>

    <div class="volume-container">
      <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      <input type="range" class="volume-slider" id="volumeSlider" min="0" max="100" value="80" />
    </div>

    <div class="lyrics-container" id="lyricsContainer">
      <div class="lyrics-empty" id="lyricsEmpty">No lyrics available</div>
    </div>
  </div>

  <audio id="audio"></audio>

	  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const audio = document.getElementById('audio');
    const coverImg = document.getElementById('coverImg');
    const noCover = document.getElementById('noCover');
    const titleEl = document.getElementById('title');
    const artistEl = document.getElementById('artist');
    const albumEl = document.getElementById('album');
    const currentTimeEl = document.getElementById('currentTime');
    const totalTimeEl = document.getElementById('totalTime');
    const progressFill = document.getElementById('progressFill');
    const progressBar = document.getElementById('progressBar');
    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const pauseIcon = document.getElementById('pauseIcon');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const repeatBtn = document.getElementById('repeatBtn');
    const repeatBadge = document.getElementById('repeatBadge');
    const volumeSlider = document.getElementById('volumeSlider');
    const lyricsContainer = document.getElementById('lyricsContainer');
    const lyricsEmpty = document.getElementById('lyricsEmpty');

    audio.volume = 0.8;

    // Track duration from API (fallback for when audio.duration is Infinity/NaN)
    let songDuration = 0;
    // Shuffle & Repeat state
    let shuffleOn = false;
    // repeatMode: 0 = off, 1 = repeat all, 2 = repeat one
	    let repeatMode = 0;
	    let currentSongId = null;
    // Lyrics state
    let lyricsLines = []; // {start: ms, value: string}
    let isSynced = false;
    let userScrolling = false;
    let userScrollTimeout = null;

    function formatTime(s) {
      if (!s || !isFinite(s) || isNaN(s)) return '0:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    function getDuration() {
      // Prefer audio element duration, fall back to API duration
      if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration)) {
        return audio.duration;
      }
      return songDuration;
    }

    // --- Time display & progress ---
    audio.addEventListener('timeupdate', () => {
      const dur = getDuration();
      if (dur > 0) {
        const pct = (audio.currentTime / dur) * 100;
        progressFill.style.width = Math.min(pct, 100) + '%';
      }
      currentTimeEl.textContent = formatTime(audio.currentTime);
      totalTimeEl.textContent = formatTime(dur);
      updateActiveLyric();
    });

    audio.addEventListener('ended', () => {
      if (repeatMode === 2) {
        // Repeat one: replay the same track
        audio.currentTime = 0;
        audio.play();
      } else {
        // Tell extension to go next; it handles repeat-all and shuffle
        vscode.postMessage({ command: 'next', data: { repeatMode, shuffleOn } });
      }
    });

	    audio.addEventListener('play', () => {
	      playIcon.classList.add('hidden');
	      pauseIcon.classList.remove('hidden');
	    });

	    audio.addEventListener('pause', () => {
	      playIcon.classList.remove('hidden');
	      pauseIcon.classList.add('hidden');
	    });

    playBtn.addEventListener('click', () => {
      if (audio.paused) { audio.play(); } else { audio.pause(); }
    });

    prevBtn.addEventListener('click', () => vscode.postMessage({ command: 'previous' }));
    nextBtn.addEventListener('click', () => vscode.postMessage({ command: 'next', data: { shuffleOn } }));

    // --- Shuffle toggle ---
    shuffleBtn.addEventListener('click', () => {
      shuffleOn = !shuffleOn;
      shuffleBtn.classList.toggle('active', shuffleOn);
      shuffleBtn.title = shuffleOn ? 'Shuffle: On' : 'Shuffle: Off';
      vscode.postMessage({ command: 'shuffle', data: { enabled: shuffleOn } });
    });

    // --- Repeat toggle: off -> all -> one -> off ---
    repeatBtn.addEventListener('click', () => {
      repeatMode = (repeatMode + 1) % 3;
      repeatBtn.classList.toggle('active', repeatMode > 0);
      if (repeatMode === 0) {
        repeatBtn.title = 'Repeat: Off';
        repeatBadge.style.display = 'none';
      } else if (repeatMode === 1) {
        repeatBtn.title = 'Repeat: All';
        repeatBadge.textContent = '';
        repeatBadge.style.display = 'none';
      } else {
        repeatBtn.title = 'Repeat: One';
        repeatBadge.textContent = '1';
        repeatBadge.style.display = 'block';
      }
      vscode.postMessage({ command: 'repeat', data: { mode: repeatMode } });
    });

    volumeSlider.addEventListener('input', (e) => {
      audio.volume = e.target.value / 100;
    });

    // --- Seek by clicking progress bar ---
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const dur = getDuration();
      if (dur > 0) { audio.currentTime = pct * dur; }
    });

    // --- Click timestamp to jump to a specific time ---
    function promptSeek() {
      const dur = getDuration();
      if (dur <= 0) return;
	      // Use a simple inline input overlay
	      const input = document.createElement('input');
	      input.type = 'text';
	      input.placeholder = 'mm:ss';
	      input.className = 'seek-input';
	      document.body.appendChild(input);
      input.focus();

      function finish() {
        const val = input.value.trim();
        input.remove();
        if (!val) return;
        const parts = val.split(':');
        let seconds = 0;
        if (parts.length === 2) {
          seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else if (parts.length === 1) {
          seconds = parseInt(parts[0]);
        }
        if (!isNaN(seconds) && seconds >= 0 && seconds <= dur) {
          audio.currentTime = seconds;
        }
      }

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { finish(); }
        if (e.key === 'Escape') { input.remove(); }
      });
      input.addEventListener('blur', () => { input.remove(); });
    }

    currentTimeEl.addEventListener('click', promptSeek);
    totalTimeEl.addEventListener('click', promptSeek);

    // --- Synced Lyrics ---
	    function renderLyrics() {
      // Clear existing lyrics (keep empty message element)
      lyricsContainer.innerHTML = '';

      if (lyricsLines.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'lyrics-empty';
        empty.textContent = 'No lyrics available';
        lyricsContainer.appendChild(empty);
        return;
	    }

	    function resetPlayer() {
	      audio.pause();
	      audio.removeAttribute('src');
	      audio.load();
	      currentSongId = null;
	      songDuration = 0;
	      lyricsLines = [];
	      isSynced = false;
	      titleEl.textContent = 'No track playing';
	      artistEl.textContent = 'Select a song from the library';
	      albumEl.textContent = '';
	      currentTimeEl.textContent = '0:00';
	      totalTimeEl.textContent = '0:00';
	      progressFill.style.width = '0%';
	      coverImg.removeAttribute('src');
	      coverImg.classList.add('hidden');
	      noCover.classList.remove('hidden');
	      renderLyrics();
	    }

      lyricsLines.forEach((line, i) => {
        const el = document.createElement('div');
        el.className = 'lyrics-line';
        el.textContent = line.value || '♪';
        el.dataset.index = i;
        if (isSynced && line.start != null) {
          el.addEventListener('click', () => {
            audio.currentTime = line.start / 1000;
          });
        }
        lyricsContainer.appendChild(el);
      });
    }

    function updateActiveLyric() {
      if (!isSynced || lyricsLines.length === 0) return;
      const currentMs = audio.currentTime * 1000;
      let activeIdx = -1;
      for (let i = lyricsLines.length - 1; i >= 0; i--) {
        if (lyricsLines[i].start != null && lyricsLines[i].start <= currentMs) {
          activeIdx = i;
          break;
        }
      }

      const lineEls = lyricsContainer.querySelectorAll('.lyrics-line');
      lineEls.forEach((el, i) => {
        el.classList.toggle('active', i === activeIdx);
        el.classList.toggle('past', i < activeIdx);
      });

      // Auto-scroll to active line (unless user is scrolling)
      if (activeIdx >= 0 && !userScrolling) {
        const activeEl = lineEls[activeIdx];
        if (activeEl) {
          const containerRect = lyricsContainer.getBoundingClientRect();
          const elRect = activeEl.getBoundingClientRect();
          const offset = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
          lyricsContainer.scrollTop += offset;
        }
      }
    }

    // Pause auto-scroll when user scrolls manually
    lyricsContainer.addEventListener('wheel', () => {
      userScrolling = true;
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => { userScrolling = false; }, 4000);
    });
    lyricsContainer.addEventListener('touchmove', () => {
      userScrolling = true;
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => { userScrolling = false; }, 4000);
    });

    // --- Message handling ---
    window.addEventListener('message', (event) => {
      const msg = event.data;
	      if (msg.type === 'track') {
	        currentSongId = msg.song.id;
	        // Store API duration (in seconds) as fallback
	        songDuration = msg.song.duration || 0;
        // Reset lyrics
        lyricsLines = [];
        isSynced = false;
        renderLyrics();

        audio.src = msg.streamUrl;
        audio.play();
        titleEl.textContent = msg.song.title;
        artistEl.textContent = msg.song.artist;
        albumEl.textContent = msg.song.album;
	        totalTimeEl.textContent = formatTime(songDuration);
	        if (msg.coverUrl) {
	          coverImg.src = msg.coverUrl;
	          coverImg.classList.remove('hidden');
	          noCover.classList.add('hidden');
	        } else {
	          coverImg.removeAttribute('src');
	          coverImg.classList.add('hidden');
	          noCover.classList.remove('hidden');
	        }
	      }
	      if (msg.type === 'lyrics') {
	        if (msg.songId !== currentSongId) return;
	        const allLyrics = msg.lyrics || [];
        // Prefer synced lyrics
        const synced = allLyrics.find(l => l.synced);
        const unsynced = allLyrics.find(l => !l.synced);
        const chosen = synced || unsynced;
        if (chosen && chosen.line && chosen.line.length > 0) {
          lyricsLines = chosen.line;
          isSynced = !!chosen.synced;
        } else {
          lyricsLines = [];
          isSynced = false;
        }
        renderLyrics();
      }
	      if (msg.type === 'playPause') {
	        if (audio.paused) { audio.play(); } else { audio.pause(); }
	      }
	      if (msg.type === 'stop') {
	        resetPlayer();
	      }
	    });
	  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
