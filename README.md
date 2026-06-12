<div align="center">

<img src="https://raw.githubusercontent.com/AlanHuang99/vscode-subsonic-player/main/media/icon.png" alt="Music Player for VS Code" width="96" height="96" />

# Music Player for VS Code

Listen to your [Navidrome](https://www.navidrome.org/) or [Subsonic-compatible](http://www.subsonic.org/pages/api.jsp) music library without leaving the editor.

[![Open VSX](https://img.shields.io/open-vsx/v/alanhuang/subsonic-player?label=Open%20VSX)](https://open-vsx.org/extension/alanhuang/subsonic-player)
[![Downloads](https://img.shields.io/open-vsx/dt/alanhuang/subsonic-player?label=downloads)](https://open-vsx.org/extension/alanhuang/subsonic-player)
[![CI](https://github.com/AlanHuang99/vscode-subsonic-player/actions/workflows/ci.yml/badge.svg)](https://github.com/AlanHuang99/vscode-subsonic-player/actions/workflows/ci.yml)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

<br />

<img src="https://raw.githubusercontent.com/AlanHuang99/vscode-subsonic-player/main/media/screenshot-player.png" alt="Player panel with artwork, transport controls, and synced lyrics" width="520" />

</div>

## Features

- Navidrome and Subsonic-compatible servers (Subsonic API v1.16.1 or newer)
- Multiple saved servers, with passwords kept in VS Code SecretStorage
- Library browsing by favorite songs, recent albums, random albums, most played, and artists
- Album and playlist detail views
- Queue control: play now, play next, add to queue, reorder, remove, clear
- Favorites for albums and tracks
- Synced lyrics with click-to-seek
- Keyboard shortcuts for play/pause, next, and previous
- Streams audio from your server; it does not download tracks for offline use

## Requirements

- A running [Navidrome](https://www.navidrome.org/) or Subsonic-compatible server (Subsonic API v1.16.1 or newer)
- VS Code 1.85 or newer, or another editor that uses the [Open VSX](https://open-vsx.org/) gallery

## Install

The extension is published on Open VSX: https://open-vsx.org/extension/alanhuang/subsonic-player

If your editor uses Open VSX, search for **Music Player for VS Code** or `alanhuang.subsonic-player` in the Extensions view.

If you use Microsoft VS Code without Open VSX configured as your extension gallery, download the VSIX from the Open VSX page and install it with:

```bash
code --install-extension path/to/alanhuang.subsonic-player-*.vsix
```

You can also install a downloaded VSIX from the Extensions view: `...` → `Install from VSIX...`.

## Getting started

1. Run **Subsonic Player: Add Server** and enter your server URL, username, and password.
2. Open the **Music** view from the activity bar.
3. Expand **Library**, open an album, and choose **Play All**.

Run **Subsonic Player: Open Music Player** to show the player panel. It shows artwork, transport controls, volume, progress, repeat/shuffle, and synced lyrics when your server provides them.

## Browse, queue, and favorite

Open an album or playlist to inspect its tracks before touching your queue. Each row has quick actions for play next, add to queue, and favorite; the detail header can play the whole album or playlist now, queue it next, or append it to the end.

<div align="center">

<img src="https://raw.githubusercontent.com/AlanHuang99/vscode-subsonic-player/main/media/screenshot-playlist.png" alt="Playlist detail view next to the player panel" width="620" />

</div>

- **Build a queue** — right-click albums, playlists, playlist tracks, songs, or queue items, then choose **Play Next** or **Add to Queue**. Reorder or remove tracks from the **Queue** view.
- **Use favorites** — favorite albums or tracks from context menus or detail views. Open **Library → Favorite Songs** to find starred tracks, or **Library → Now Playing** to favorite the active track without opening the player.
- **Search** — run **Subsonic Player: Search Library**, pick a song or album, then choose **Play Now**, **Play Next**, or **Add to Queue**.
- **Switch servers** — run **Subsonic Player: Switch Server** to pick another saved server, add a new one, or remove an old one.

## Keyboard shortcuts

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Play / Pause | `Ctrl+Alt+P` | `Cmd+Alt+P` |
| Next track | `Ctrl+Alt+Right` | `Cmd+Alt+Right` |
| Previous track | `Ctrl+Alt+Left` | `Cmd+Alt+Left` |

## Commands

Available from the Command Palette under **Subsonic Player**:

| Command | Description |
| --- | --- |
| Add Server | Save a server URL, username, and password |
| Switch Server | Choose, add, or remove a saved server |
| Remove Server | Delete a saved server |
| Open Music Player | Show the player panel |
| Play / Pause, Next Track, Previous Track | Transport controls |
| Search Library | Find a song or album |
| Play Random Songs | Queue a set of random tracks |
| Refresh Library | Reload library and playlist data |
| Clear Queue | Empty the play queue |

Context menus provide the more specific actions, such as opening albums, favoriting tracks, moving queue items, and adding individual songs to the queue.

## Compatibility

[Navidrome](https://www.navidrome.org/) is the recommended server. Any server implementing the Subsonic API v1.16.1 or newer is also supported. Navidrome has the most complete experience because the extension can use its native playlist API for smart playlists.

## Privacy and security

- Server passwords are stored in VS Code's encrypted SecretStorage.
- Legacy plain-text password settings are migrated automatically when possible.
- The player streams audio directly from your configured server.
- Webviews use Content Security Policy headers and nonce-based scripts.

## Build from source

Prerequisites: Node.js 20 and npm.

```bash
git clone https://github.com/AlanHuang99/vscode-subsonic-player.git
cd vscode-subsonic-player
npm ci
npm run compile
npm run lint
```

Package a local VSIX:

```bash
npm run package
```

Run the extension locally:

1. Open this repository in VS Code.
2. Press `F5`.
3. Test in the Extension Development Host window.

Releases are triggered by pushing a `v*` tag. The release workflow creates a GitHub Release and publishes to Open VSX. The extension is not published to the VS Code Marketplace.

## Tech stack

| Area | Implementation |
| --- | --- |
| Language | TypeScript |
| Editor integration | VS Code Extension API — tree views and webviews |
| Playback | HTML5 audio in a webview |
| Server access | Subsonic API client |
| Credentials | VS Code SecretStorage |

## Links

- [Open VSX listing](https://open-vsx.org/extension/alanhuang/subsonic-player)
- [GitHub releases](https://github.com/AlanHuang99/vscode-subsonic-player/releases)
- [Navidrome](https://www.navidrome.org/)
- [Subsonic API](http://www.subsonic.org/pages/api.jsp)

## License

[MIT](LICENSE)
