#!/usr/bin/env node
import { pluginCreate, pluginValidate, pluginPack } from './commands/plugin.js';

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

console.log('🐾 xClaw CLI v2.0.0');

switch (command) {
  case 'plugin': {
    switch (subcommand) {
      case 'create':
        if (!args[2]) { console.error('Usage: xclaw plugin create <name>'); process.exit(1); }
        pluginCreate(args[2], args[3]);
        break;
      case 'validate':
        pluginValidate(args[2] ?? process.cwd());
        break;
      case 'pack':
        pluginPack(args[2] ?? process.cwd());
        break;
      default:
        console.log('Usage: xclaw plugin <create|validate|pack>');
    }
    break;
  }
  default:
    console.log('Usage: xclaw <command>');
    console.log('Commands:');
    console.log('  plugin create <name>   Scaffold a new plugin');
    console.log('  plugin validate [dir]  Validate plugin structure');
    console.log('  plugin pack [dir]      Package plugin for distribution');
}
