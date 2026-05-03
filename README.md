# Music Player for VS Code

A focused music player inside VS Code for people who keep their music on
[Navidrome](https://www.navidrome.org/) or another
[Subsonic-compatible](http://www.subsonic.org/pages/api.jsp) server.

[![Open VSX](https://img.shields.io/open-vsx/v/alanhuang/subsonic-player?label=Open%20VSX)](https://open-vsx.org/extension/alanhuang/subsonic-player)
[![Downloads](https://img.shields.io/open-vsx/dt/alanhuang/subsonic-player?label=downloads)](https://open-vsx.org/extension/alanhuang/subsonic-player)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Install

The extension is published on Open VSX:

https://open-vsx.org/extension/alanhuang/subsonic-player

If your editor uses Open VSX, search for **Music Player for VS Code** or
`alanhuang.subsonic-player` in the Extensions view.

If you use Microsoft VS Code and do not have Open VSX configured as your
extension gallery, download the VSIX from the Open VSX page and install it with:

```bash
code --install-extension path/to/alanhuang.subsonic-player-*.vsix
```

You can also install a downloaded VSIX from the Extensions view:
`...` -> `Install from VSIX...`.

## Why Use It

This extension is for listening without leaving the editor. It keeps the
surface small: browse your library, open an album or playlist, build a queue,
favorite tracks, and keep synced lyrics nearby while you work.

It supports:

- Navidrome and Subsonic-compatible servers
- Multiple saved servers with passwords stored in VS Code SecretStorage
- Library browsing by favorite songs, recent albums, random albums, most played, and artists
- Album and playlist detail views
- Queue actions: play now, play next, add to queue, reorder, remove, clear
- Favorites for albums and tracks
- Synced lyrics with click-to-seek
- Keyboard shortcuts for play/pause, next, and previous

## Player

Open **Subsonic Player: Open Music Player** to show the player panel. The panel
shows artwork, transport controls, volume, progress, repeat/shuffle, and synced
lyrics when your server provides them.

![Player with synced lyrics](https://raw.githubusercontent.com/AlanHuang99/vscode-subsonic-player/main/media/screenshot-player.png)

## Playlists

Open a playlist to inspect the tracks before replacing your queue. Each row has
quick actions for play next, add to queue, and favorite. The playlist header can
play the whole playlist now, queue it next, or append it to the end.

![Playlist detail view](https://raw.githubusercontent.com/AlanHuang99/vscode-subsonic-player/main/media/screenshot-playlist.png)

## Common Workflows

Add a server:

1. Run **Subsonic Player: Add Server**.
2. Enter your server URL, username, and password.
3. Open the **Music** activity bar view.

Play an album:

1. Expand **Library**.
2. Open **Recent Albums**, **Random Albums**, **Most Played**, or an artist.
3. Click an album to open the album detail view.
4. Choose **Play All**, **Play Next**, or **Add to Queue**.

Build a queue:

1. Right-click albums, playlists, playlist tracks, songs, or queue items.
2. Choose **Play Next** or **Add to Queue**.
3. Reorder or remove tracks from the **Queue** view.

Use favorites:

1. Favorite albums or tracks from context menus or detail views.
2. Open **Library -> Favorite Songs** to find starred tracks.
3. Use **Library -> Now Playing** to favorite the active track without opening the player.

Search:

1. Run **Subsonic Player: Search Library**.
2. Pick a song or album.
3. Choose **Play Now**, **Play Next**, or **Add to Queue**.

Switch servers:

1. Run **Subsonic Player: Switch Server**.
2. Pick another saved server, add a new server, or remove an old one.

## Keyboard Shortcuts

- `Ctrl+Alt+P` / `Cmd+Alt+P`: play or pause
- `Ctrl+Alt+Right` / `Cmd+Alt+Right`: next track
- `Ctrl+Alt+Left` / `Cmd+Alt+Left`: previous track

## Commands

Most commands are available from the Command Palette under **Subsonic Player**:

- Add Server
- Switch Server
- Remove Server
- Open Music Player
- Play / Pause
- Next Track
- Previous Track
- Search Library
- Play Random Songs
- Refresh Library
- Clear Queue

Context menus provide the more specific actions, such as opening albums,
favoriting tracks, moving queue items, and adding individual songs to the queue.

## Compatibility

Recommended server:

- [Navidrome](https://www.navidrome.org/)

Also supported:

- Servers implementing the Subsonic API v1.16.1 or newer

Navidrome has the best experience because the extension can also use Navidrome's
native playlist API for smart playlists.

## Privacy And Security

- Server passwords are stored in VS Code's encrypted SecretStorage.
- Legacy plain-text password settings are migrated automatically when possible.
- The player streams audio directly from your configured server.
- Webviews use Content Security Policy headers and nonce-based scripts.

## Development

```bash
npm ci
npm run compile
npm run lint
npm audit
```

Package a local VSIX:

```bash
npm run package
```

Run the extension locally:

1. Open this repository in VS Code.
2. Press `F5`.
3. Test in the Extension Development Host window.

Release notes:

- Releases are triggered by pushing a `v*` tag.
- The workflow creates a GitHub Release and publishes to Open VSX.
- The extension is not published to the VS Code Marketplace.

## Links

- [Open VSX listing](https://open-vsx.org/extension/alanhuang/subsonic-player)
- [GitHub releases](https://github.com/AlanHuang99/vscode-subsonic-player/releases)
- [Navidrome](https://www.navidrome.org/)
- [Subsonic API](http://www.subsonic.org/pages/api.jsp)

## License

[MIT](LICENSE)
