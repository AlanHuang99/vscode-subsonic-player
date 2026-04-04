import * as vscode from 'vscode';

export interface ServerProfile {
  name: string;
  url: string;
  username: string;
}

const SERVERS_KEY = 'subsonicPlayer.servers';
const ACTIVE_KEY = 'subsonicPlayer.activeServer';

export class ServerManager {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(
    private globalState: vscode.Memento,
    private secrets: vscode.SecretStorage,
  ) {}

  getServers(): ServerProfile[] {
    return this.globalState.get<ServerProfile[]>(SERVERS_KEY, []);
  }

  getActiveServerName(): string | undefined {
    return this.globalState.get<string>(ACTIVE_KEY);
  }

  getActiveServer(): ServerProfile | undefined {
    const name = this.getActiveServerName();
    if (!name) { return this.getServers()[0]; }
    return this.getServers().find(s => s.name === name) || this.getServers()[0];
  }

  async getPassword(serverName: string): Promise<string> {
    return await this.secrets.get(`subsonicPlayer.password.${serverName}`) || '';
  }

  async getActiveCredentials(): Promise<{ serverUrl: string; username: string; password: string } | undefined> {
    const server = this.getActiveServer();
    if (!server) { return undefined; }
    const password = await this.getPassword(server.name);
    return { serverUrl: server.url, username: server.username, password };
  }

  async addServer(profile: ServerProfile, password: string): Promise<void> {
    const servers = this.getServers();
    // Replace if same name exists
    const idx = servers.findIndex(s => s.name === profile.name);
    if (idx >= 0) {
      servers[idx] = profile;
    } else {
      servers.push(profile);
    }
    await this.globalState.update(SERVERS_KEY, servers);
    await this.secrets.store(`subsonicPlayer.password.${profile.name}`, password);
    // Auto-activate if it's the only server
    if (servers.length === 1) {
      await this.setActive(profile.name);
    }
    this._onDidChange.fire();
  }

  async removeServer(name: string): Promise<void> {
    const servers = this.getServers().filter(s => s.name !== name);
    await this.globalState.update(SERVERS_KEY, servers);
    await this.secrets.delete(`subsonicPlayer.password.${name}`);
    if (this.getActiveServerName() === name) {
      await this.globalState.update(ACTIVE_KEY, servers[0]?.name);
    }
    this._onDidChange.fire();
  }

  async setActive(name: string): Promise<void> {
    await this.globalState.update(ACTIVE_KEY, name);
    this._onDidChange.fire();
  }

  // --- UI flows ---

  async promptAddServer(): Promise<boolean> {
    const name = await vscode.window.showInputBox({
      prompt: 'Server name (e.g. "Home", "Work")',
      placeHolder: 'My Navidrome',
      validateInput: (v) => v.trim() ? null : 'Name is required',
    });
    if (!name) { return false; }

    const url = await vscode.window.showInputBox({
      prompt: 'Server URL',
      placeHolder: 'http://localhost:4533',
      validateInput: (v) => {
        try { new URL(v); return null; } catch { return 'Enter a valid URL'; }
      },
    });
    if (!url) { return false; }

    const username = await vscode.window.showInputBox({
      prompt: 'Username',
      placeHolder: 'admin',
      validateInput: (v) => v.trim() ? null : 'Username is required',
    });
    if (!username) { return false; }

    const password = await vscode.window.showInputBox({
      prompt: 'Password',
      password: true,
      validateInput: (v) => v ? null : 'Password is required',
    });
    if (!password) { return false; }

    await this.addServer({ name: name.trim(), url: url.trim().replace(/\/+$/, ''), username: username.trim() }, password);
    vscode.window.showInformationMessage(`Server "${name}" added.`);
    return true;
  }

  async promptSwitchServer(): Promise<boolean> {
    const servers = this.getServers();
    if (servers.length === 0) {
      const add = await vscode.window.showInformationMessage(
        'No servers configured.', 'Add Server',
      );
      if (add) { return this.promptAddServer(); }
      return false;
    }

    const active = this.getActiveServerName();
    const items = servers.map(s => ({
      label: s.name === active ? `$(check) ${s.name}` : `     ${s.name}`,
      description: `${s.username}@${s.url}`,
      name: s.name,
    }));
    items.push({ label: '$(add) Add new server...', description: '', name: '__add__' });
    items.push({ label: '$(trash) Remove a server...', description: '', name: '__remove__' });

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a server',
    });
    if (!picked) { return false; }

    if (picked.name === '__add__') {
      return this.promptAddServer();
    }
    if (picked.name === '__remove__') {
      return this.promptRemoveServer();
    }

    await this.setActive(picked.name);
    vscode.window.showInformationMessage(`Switched to "${picked.name}".`);
    return true;
  }

  async promptRemoveServer(): Promise<boolean> {
    const servers = this.getServers();
    if (servers.length === 0) { return false; }

    const picked = await vscode.window.showQuickPick(
      servers.map(s => ({ label: s.name, description: `${s.username}@${s.url}` })),
      { placeHolder: 'Select server to remove' },
    );
    if (!picked) { return false; }

    const confirm = await vscode.window.showWarningMessage(
      `Remove server "${picked.label}"?`, { modal: true }, 'Remove',
    );
    if (confirm !== 'Remove') { return false; }

    await this.removeServer(picked.label);
    vscode.window.showInformationMessage(`Server "${picked.label}" removed.`);
    return true;
  }

  // Migrate from old plain-text settings (one-time)
  async migrateFromSettings(): Promise<void> {
    const config = vscode.workspace.getConfiguration('subsonicPlayer');
    const url = config.get<string>('serverUrl') || '';
    const username = config.get<string>('username') || '';
    const password = config.get<string>('password') || '';

    if (!url || !username || !password) { return; }
    // Only migrate if no servers configured yet
    if (this.getServers().length > 0) { return; }

    const name = new URL(url).hostname || 'Default';
    await this.addServer({ name, url, username }, password);

    // Clear the plain-text password from settings
    await config.update('password', undefined, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
      `Migrated server "${name}" to secure storage. Plain-text password has been removed from settings.`,
    );
  }
}
