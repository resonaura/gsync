import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { LogEntry, LogLevel, ProgressMetrics, SyncConfig, SyncStatus } from '../types.js';
import { ProgressParser } from './progress-parser.js';

export class SyncRunner extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private parser: ProgressParser;
  private status: SyncStatus = 'IDLE';
  private config: SyncConfig;
  private logIdCounter = 0;
  private isPaused = false;

  constructor(config: SyncConfig) {
    super();
    this.config = config;
    this.parser = new ProgressParser();
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public getPid(): number | undefined {
    return this.childProcess?.pid;
  }

  public start(): void {
    if (this.childProcess) return;

    this.setStatus('SCANNING');
    this.addLog('INFO', `Starting sync: ${this.config.source} -> ${this.config.remote}`);

    // Build rclone args with enforced cinema excludes
    const args = [
      'sync',
      this.config.source,
      this.config.remote,
      '--track-renames',
      '--metadata',
      `--transfers=${this.config.transfers || 2}`,
      `--checkers=${this.config.checkers || 4}`,
      `--bwlimit=${this.config.bwlimit || '15M'}`,
      '--stats=1s',
      '--stats-one-line',
      '--log-level=INFO',
      '--exclude=cinema/**',
      '--exclude=cinema/',
      '--exclude=/cinema/**',
      '--exclude=.DS_Store',
      '--exclude=node_modules/**',
      '--exclude=.git/**',
    ];

    if (this.config.excludeFile) {
      args.push(`--exclude-from=${this.config.excludeFile}`);
    }

    try {
      this.childProcess = spawn('rclone', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.setStatus('RUNNING');

      this.handleStream(this.childProcess.stdout);
      this.handleStream(this.childProcess.stderr);

      this.childProcess.on('error', (err) => {
        this.setStatus('ERROR');
        this.addLog('ERROR', `Process error: ${err.message}`);
        this.emit('error', err);
      });

      this.childProcess.on('close', (code) => {
        this.childProcess = null;
        if (code === 0) {
          this.setStatus('COMPLETED');
          this.addLog('SUCCESS', 'Synchronization completed successfully! (100%)');
        } else {
          this.setStatus('ERROR');
          this.addLog('ERROR', `Process exited with code ${code}`);
        }
        this.emit('exit', code);
      });
    } catch (err: unknown) {
      this.setStatus('ERROR');
      const message = err instanceof Error ? err.message : String(err);
      this.addLog('ERROR', `Failed to spawn rclone: ${message}`);
    }
  }

  public pause(): boolean {
    if (!this.childProcess || !this.childProcess.pid || this.isPaused) return false;
    try {
      process.kill(this.childProcess.pid, 'SIGSTOP');
      this.isPaused = true;
      this.setStatus('PAUSED');
      this.addLog('WARN', '⏸ Synchronization PAUSED by user (SIGSTOP)');
      return true;
    } catch (err) {
      this.addLog('ERROR', `Failed to pause process: ${err}`);
      return false;
    }
  }

  public resume(): boolean {
    if (!this.childProcess || !this.childProcess.pid || !this.isPaused) return false;
    try {
      process.kill(this.childProcess.pid, 'SIGCONT');
      this.isPaused = false;
      this.setStatus('RUNNING');
      this.addLog('INFO', '▶ Synchronization RESUMED by user (SIGCONT)');
      return true;
    } catch (err) {
      this.addLog('ERROR', `Failed to resume process: ${err}`);
      return false;
    }
  }

  public togglePause(): boolean {
    if (this.isPaused) {
      return this.resume();
    } else {
      return this.pause();
    }
  }

  public stop(): void {
    if (!this.childProcess) return;
    try {
      if (this.childProcess.pid) {
        if (this.isPaused) {
          process.kill(this.childProcess.pid, 'SIGCONT');
        }
        this.childProcess.kill('SIGTERM');
      }
    } catch {
      /* ignore */
    }
  }

  private handleStream(stream: NodeJS.ReadableStream | null): void {
    if (!stream) return;
    let buffer = '';

    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split(/[\r\n]+/);
      buffer = parts.pop() || '';

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const { isProgress, metrics } = this.parser.parseLine(trimmed);
        if (isProgress && metrics) {
          this.emit('metrics', metrics);
        } else {
          const level = this.detectLogLevel(trimmed);
          this.addLog(level, trimmed);
        }
      }
    });
  }

  private detectLogLevel(line: string): LogLevel {
    const upper = line.toUpperCase();
    if (upper.includes('ERROR') || upper.includes('FATAL') || upper.includes('FAILED')) return 'ERROR';
    if (upper.includes('WARN') || upper.includes('WAITING') || upper.includes('PAUSED')) return 'WARN';
    if (upper.includes('DONE') || upper.includes('COMPLETED') || upper.includes('SUCCESS') || upper.includes('ПОГНАЛИ'))
      return 'SUCCESS';
    if (upper.includes('DEBUG')) return 'DEBUG';
    return 'INFO';
  }

  private setStatus(status: SyncStatus): void {
    this.status = status;
    this.emit('status', status);
  }

  private addLog(level: LogLevel, message: string): void {
    const entry: LogEntry = {
      id: ++this.logIdCounter,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      raw: message,
    };
    this.emit('log', entry);
  }
}
