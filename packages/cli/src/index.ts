#!/usr/bin/env node
// ============================================================
// AutoX CLI - Command-line interface for the AutoX platform
// ============================================================

import { Command } from 'commander';
import { gatewayCommand } from './commands/gateway.js';
import { chatCommand } from './commands/chat.js';
import { skillsCommand } from './commands/skills.js';
import { doctorCommand } from './commands/doctor.js';

const program = new Command();

program
  .name('autox')
  .description('AutoX - AI Agent Platform')
  .version('0.1.0');

program.addCommand(gatewayCommand);
program.addCommand(chatCommand);
program.addCommand(skillsCommand);
program.addCommand(doctorCommand);

program.parse();
