#!/usr/bin/env node
import { Command } from 'commander';
import { SharedContextManager } from '../lib/context-manager.js';
import chalk from 'chalk';

const program = new Command();
const manager = new SharedContextManager();

program
  .name('ccb-context')
  .description('Shared context manager for CCB cross-instance collaboration')
  .version('0.1.0');

program
  .command('share <instance-id>')
  .description('Share context from current instance')
  .option('-m, --message <text>', 'Context message')
  .option('-f, --file <path>', 'Context file path')
  .option('-p, --permission <level>', 'Permission level (public/team/private)', 'team')
  .action(async (instanceId, options) => {
    try {
      const result = await manager.share(instanceId, {
        message: options.message,
        file: options.file,
        permission: options.permission
      });
      console.log(chalk.green('✓'), 'Context shared:', result.id);
      console.log(chalk.gray('  Permission:'), result.permission);
      console.log(chalk.gray('  Timestamp:'), new Date(result.timestamp).toLocaleString());
    } catch (error) {
      console.error(chalk.red('✗'), 'Failed to share context:', error.message);
      process.exit(1);
    }
  });

program
  .command('query')
  .description('Query available shared contexts')
  .option('-i, --instance <id>', 'Filter by instance ID')
  .option('-p, --permission <level>', 'Filter by permission level')
  .option('-l, --limit <number>', 'Limit results', '10')
  .action(async (options) => {
    try {
      const contexts = await manager.query({
        instanceId: options.instance,
        permission: options.permission,
        limit: parseInt(options.limit)
      });

      if (contexts.length === 0) {
        console.log(chalk.gray('No shared contexts found'));
        return;
      }

      console.log(chalk.bold(`\nShared Contexts (${contexts.length}):`));
      contexts.forEach(ctx => {
        console.log(chalk.cyan('●'), ctx.id);
        console.log(chalk.gray('  From:'), ctx.instanceId);
        console.log(chalk.gray('  Permission:'), ctx.permission);
        console.log(chalk.gray('  Time:'), new Date(ctx.timestamp).toLocaleString());
        if (ctx.message) {
          console.log(chalk.gray('  Message:'), ctx.message.substring(0, 60) + '...');
        }
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red('✗'), 'Failed to query contexts:', error.message);
      process.exit(1);
    }
  });

program
  .command('transfer <context-id> <target-instance>')
  .description('Transfer context to another instance')
  .action(async (contextId, targetInstance) => {
    try {
      await manager.transfer(contextId, targetInstance);
      console.log(chalk.green('✓'), 'Context transferred to:', targetInstance);
    } catch (error) {
      console.error(chalk.red('✗'), 'Failed to transfer context:', error.message);
      process.exit(1);
    }
  });

program
  .command('permissions <context-id>')
  .description('Manage context permissions')
  .option('-s, --set <level>', 'Set permission level (public/team/private)')
  .option('-a, --allow <instance>', 'Allow specific instance')
  .option('-d, --deny <instance>', 'Deny specific instance')
  .action(async (contextId, options) => {
    try {
      if (options.set) {
        await manager.setPermission(contextId, options.set);
        console.log(chalk.green('✓'), 'Permission updated:', options.set);
      }
      if (options.allow) {
        await manager.allowInstance(contextId, options.allow);
        console.log(chalk.green('✓'), 'Instance allowed:', options.allow);
      }
      if (options.deny) {
        await manager.denyInstance(contextId, options.deny);
        console.log(chalk.green('✓'), 'Instance denied:', options.deny);
      }
    } catch (error) {
      console.error(chalk.red('✗'), 'Failed to update permissions:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all contexts from current instance')
  .action(async () => {
    try {
      const contexts = await manager.listOwn();
      if (contexts.length === 0) {
        console.log(chalk.gray('No contexts shared from this instance'));
        return;
      }

      console.log(chalk.bold(`\nYour Shared Contexts (${contexts.length}):`));
      contexts.forEach(ctx => {
        console.log(chalk.cyan('●'), ctx.id);
        console.log(chalk.gray('  Permission:'), ctx.permission);
        console.log(chalk.gray('  Accessed:'), ctx.accessCount || 0, 'times');
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red('✗'), 'Failed to list contexts:', error.message);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Clean up old contexts')
  .option('-d, --days <number>', 'Remove contexts older than N days', '7')
  .action(async (options) => {
    try {
      const removed = await manager.cleanup(parseInt(options.days));
      console.log(chalk.green('✓'), `Removed ${removed} old contexts`);
    } catch (error) {
      console.error(chalk.red('✗'), 'Failed to cleanup:', error.message);
      process.exit(1);
    }
  });

program.parse();
