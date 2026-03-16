// ============================================================
// Plugin Loader - Load plugins from npm packages or local dirs
// Reads autox.plugin.json manifests (like OpenClaw pattern)
// ============================================================

import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import type { PluginManifest, PluginType, SkillManifest, ChannelPlugin } from '@autox/shared';

export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  module: unknown;
}

export class PluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map();

  /** Load a plugin from a directory containing autox.plugin.json */
  async loadFromPath(pluginPath: string): Promise<LoadedPlugin> {
    const absPath = resolve(pluginPath);
    const manifestPath = join(absPath, 'autox.plugin.json');

    const raw = await readFile(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(raw);

    this.validateManifest(manifest);

    const entryPath = join(absPath, manifest.entry);
    const module = await import(entryPath);

    const plugin: LoadedPlugin = { manifest, path: absPath, module };
    this.plugins.set(manifest.name, plugin);
    return plugin;
  }

  /** Load a plugin from an installed npm package */
  async loadFromPackage(packageName: string): Promise<LoadedPlugin> {
    // Resolve the package's directory
    const pkgJsonPath = require.resolve(`${packageName}/package.json`);
    const pkgDir = pkgJsonPath.replace('/package.json', '');
    return this.loadFromPath(pkgDir);
  }

  /** Get a loaded plugin's skill manifest (for skill-type plugins) */
  getSkillManifest(name: string): SkillManifest | undefined {
    const plugin = this.plugins.get(name);
    if (!plugin || plugin.manifest.type !== 'skill') return undefined;
    const mod = plugin.module as { default?: SkillManifest; manifest?: SkillManifest };
    return mod.default ?? mod.manifest;
  }

  /** Get a loaded plugin's channel instance (for channel-type plugins) */
  getChannel(name: string): ChannelPlugin | undefined {
    const plugin = this.plugins.get(name);
    if (!plugin || plugin.manifest.type !== 'channel') return undefined;
    const mod = plugin.module as { default?: ChannelPlugin; channel?: ChannelPlugin };
    return mod.default ?? mod.channel;
  }

  get(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  getAll(): LoadedPlugin[] {
    return [...this.plugins.values()];
  }

  getByType(type: PluginType): LoadedPlugin[] {
    return [...this.plugins.values()].filter(p => p.manifest.type === type);
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.name) throw new Error('Plugin manifest missing "name"');
    if (!manifest.version) throw new Error('Plugin manifest missing "version"');
    if (!manifest.type) throw new Error('Plugin manifest missing "type"');
    if (!manifest.entry) throw new Error('Plugin manifest missing "entry"');

    const validTypes: PluginType[] = ['skill', 'channel', 'integration', 'theme'];
    if (!validTypes.includes(manifest.type)) {
      throw new Error(`Invalid plugin type: ${manifest.type}`);
    }
  }
}
