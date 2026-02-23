import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export type PermissionLevel = 'public' | 'team' | 'private';

export interface SharedContext {
  id: string;
  instanceId: string;
  timestamp: number;
  message?: string;
  file?: string;
  permission: PermissionLevel;
  allowedInstances?: string[];
  deniedInstances?: string[];
  accessCount?: number;
}

export interface ShareOptions {
  message?: string;
  file?: string;
  permission?: PermissionLevel;
}

export interface QueryOptions {
  instanceId?: string;
  permission?: PermissionLevel;
  limit?: number;
}

export class SharedContextManager {
  private poolPath: string;
  private currentInstanceId: string;

  constructor() {
    // Shared context pool directory
    this.poolPath = path.join(process.env.HOME || '', '.ccb', 'shared-context');
    this.ensurePool();
    this.currentInstanceId = this.detectInstanceId();
  }

  private ensurePool(): void {
    if (!fs.existsSync(this.poolPath)) {
      fs.mkdirSync(this.poolPath, { recursive: true });
    }
  }

  private detectInstanceId(): string {
    // Try to detect current CCB instance ID
    // This could be from environment variable, tmux session, or other means
    const envId = process.env.CCB_INSTANCE_ID;
    if (envId) return envId;

    // Try to get tmux session name
    try {
      const tmuxSession = execSync('tmux display-message -p "#S"', {
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();
      if (tmuxSession) return tmuxSession;
    } catch {
      // Not in tmux
    }

    // Fallback to hostname + PID
    const hostname = require('os').hostname();
    return `${hostname}-${process.pid}`;
  }

  private generateId(): string {
    return `ctx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private getContextPath(contextId: string): string {
    return path.join(this.poolPath, `${contextId}.json`);
  }

  /**
   * Share context from current instance
   */
  async share(instanceId: string, options: ShareOptions = {}): Promise<SharedContext> {
    const context: SharedContext = {
      id: this.generateId(),
      instanceId: instanceId || this.currentInstanceId,
      timestamp: Date.now(),
      message: options.message,
      file: options.file,
      permission: options.permission || 'team',
      accessCount: 0
    };

    // If file is provided, read and include content
    if (options.file && fs.existsSync(options.file)) {
      const content = fs.readFileSync(options.file, 'utf-8');
      context.message = (context.message || '') + '\n\n' + content;
    }

    // Save to pool
    const contextPath = this.getContextPath(context.id);
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));

    return context;
  }

  /**
   * Query available shared contexts
   */
  async query(options: QueryOptions = {}): Promise<SharedContext[]> {
    const files = fs.readdirSync(this.poolPath).filter(f => f.endsWith('.json'));
    let contexts: SharedContext[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.poolPath, file), 'utf-8');
        const context: SharedContext = JSON.parse(content);

        // Apply filters
        if (options.instanceId && context.instanceId !== options.instanceId) {
          continue;
        }
        if (options.permission && context.permission !== options.permission) {
          continue;
        }

        // Check permissions
        if (!this.canAccess(context)) {
          continue;
        }

        contexts.push(context);
      } catch (error: any) {
        // Skip invalid files
        console.warn(`Warning: Failed to read context file ${file}:`, error.message);
      }
    }

    // Sort by timestamp (newest first)
    contexts.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (options.limit) {
      contexts = contexts.slice(0, options.limit);
    }

    return contexts;
  }

  /**
   * Check if current instance can access a context
   */
  private canAccess(context: SharedContext): boolean {
    // Owner can always access
    if (context.instanceId === this.currentInstanceId) {
      return true;
    }

    // Check denied list
    if (context.deniedInstances?.includes(this.currentInstanceId)) {
      return false;
    }

    // Check permission level
    switch (context.permission) {
      case 'public':
        return true;
      case 'team':
        // Team members can access (simplified: same hostname)
        const currentHost = this.currentInstanceId.split('-')[0];
        const contextHost = context.instanceId.split('-')[0];
        return currentHost === contextHost;
      case 'private':
        // Only allowed instances
        return context.allowedInstances?.includes(this.currentInstanceId) || false;
      default:
        return false;
    }
  }

  /**
   * Transfer context to another instance
   */
  async transfer(contextId: string, targetInstance: string): Promise<void> {
    const contextPath = this.getContextPath(contextId);
    if (!fs.existsSync(contextPath)) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const content = fs.readFileSync(contextPath, 'utf-8');
    const context: SharedContext = JSON.parse(content);

    // Check if current instance can access
    if (!this.canAccess(context)) {
      throw new Error('Permission denied');
    }

    // Increment access count
    context.accessCount = (context.accessCount || 0) + 1;

    // Save updated context
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));

    // TODO: Implement actual transfer mechanism (e.g., via tmux, file system, etc.)
    console.log(`Context ${contextId} marked for transfer to ${targetInstance}`);
  }

  /**
   * Set permission level for a context
   */
  async setPermission(contextId: string, permission: PermissionLevel): Promise<void> {
    const contextPath = this.getContextPath(contextId);
    if (!fs.existsSync(contextPath)) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const content = fs.readFileSync(contextPath, 'utf-8');
    const context: SharedContext = JSON.parse(content);

    // Only owner can change permissions
    if (context.instanceId !== this.currentInstanceId) {
      throw new Error('Permission denied: only owner can change permissions');
    }

    context.permission = permission;
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));
  }

  /**
   * Allow specific instance to access a private context
   */
  async allowInstance(contextId: string, instanceId: string): Promise<void> {
    const contextPath = this.getContextPath(contextId);
    if (!fs.existsSync(contextPath)) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const content = fs.readFileSync(contextPath, 'utf-8');
    const context: SharedContext = JSON.parse(content);

    if (context.instanceId !== this.currentInstanceId) {
      throw new Error('Permission denied');
    }

    context.allowedInstances = context.allowedInstances || [];
    if (!context.allowedInstances.includes(instanceId)) {
      context.allowedInstances.push(instanceId);
    }

    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));
  }

  /**
   * Deny specific instance from accessing a context
   */
  async denyInstance(contextId: string, instanceId: string): Promise<void> {
    const contextPath = this.getContextPath(contextId);
    if (!fs.existsSync(contextPath)) {
      throw new Error(`Context not found: ${contextId}`);
    }

    const content = fs.readFileSync(contextPath, 'utf-8');
    const context: SharedContext = JSON.parse(content);

    if (context.instanceId !== this.currentInstanceId) {
      throw new Error('Permission denied');
    }

    context.deniedInstances = context.deniedInstances || [];
    if (!context.deniedInstances.includes(instanceId)) {
      context.deniedInstances.push(instanceId);
    }

    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));
  }

  /**
   * List contexts owned by current instance
   */
  async listOwn(): Promise<SharedContext[]> {
    return this.query({ instanceId: this.currentInstanceId });
  }

  /**
   * Cleanup old contexts
   */
  async cleanup(days: number = 7): Promise<number> {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(this.poolPath).filter(f => f.endsWith('.json'));
    let removed = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.poolPath, file), 'utf-8');
        const context: SharedContext = JSON.parse(content);

        if (context.timestamp < cutoffTime) {
          fs.unlinkSync(path.join(this.poolPath, file));
          removed++;
        }
      } catch (error: any) {
        // Skip invalid files
      }
    }

    return removed;
  }
}
