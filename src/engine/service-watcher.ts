import { EventEmitter } from 'events';
import { spawn, ChildProcess, execSync } from 'child_process';
import { LogEntry, LogLevel, ProgressMetrics, SyncStatus } from '../types.js';
import { ProgressParser } from './progress-parser.js';

export class ServiceWatcher extends EventEmitter {
  private childProcess: ChildProcess | null = null;
  private parser: ProgressParser;
  private status: SyncStatus = 'RUNNING';
  private logIdCounter = 0;
  private serviceName: string;
  private isPaused = false;

  constructor(serviceName: string = 'gdrive-sync.service') {
    super();
    this.serviceName = serviceName;
    this.parser = new ProgressParser();
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public isServiceActive(): boolean {
    try {
      const out = execSync(`systemctl is-active ${this.serviceName} 2>/dev/null`, { encoding: 'utf8' }).trim();
      return out === 'active';
    } catch {
      return false;
    }
  }

  public getActiveRclonePid(): number | null {
    try {
      const pids = execSync(`pgrep -f "rclone sync" 2>/dev/null`, { encoding: 'utf8' }).trim().split('\n');
      const pid = parseInt(pids[0], 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  public start(): void {
    this.setStatus('RUNNING');
    this.addLog('INFO', `Attached to live daemon service: ${this.serviceName}`);

    try {
      // Follow journalctl with 100 historical lines
      this.childProcess = spawn(
        'journalctl',
        ['-u', this.serviceName, '-f', '-n', '100', '--output=cat', '--no-tail'],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );

      this.childProcess.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        const lines = text.split(/[\r\n]+/);
        for (const line of lines) {
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

      this.childProcess.stderr?.on('data', (chunk: Buffer) => {
        this.addLog('WARN', chunk.toString().trim());
      });

      this.childProcess.on('close', (code) => {
        this.addLog('INFO', `Journal stream disconnected (code ${code})`);
      });
    } catch (err: unknown) {
      this.setStatus('ERROR');
      const message = err instanceof Error ? err.message : String(err);
      this.addLog('ERROR', `Failed to attach to journalctl: ${message}`);
    }
  }

  public pause(): boolean {
    const pid = this.getActiveRclonePid();
    if (!pid) {
      this.addLog('WARN', 'No active rclone transfer process found to pause.');
      return false;
    }
    try {
      process.kill(pid, 'SIGSTOP');
      this.isPaused = true;
      this.setStatus('PAUSED');
      this.addLog('WARN', `⏸ Rclone process (PID: ${pid}) PAUSED by user (SIGSTOP)`);
      return true;
    } catch (err) {
      this.addLog('ERROR', `Failed to pause rclone PID ${pid}: ${err}`);
      return false;
    }
  }

  public resume(): boolean {
    const pid = this.getActiveRclonePid();
    if (!pid) {
      this.addLog('WARN', 'No active rclone process found to resume.');
      return false;
    }
    try {
      process.kill(pid, 'SIGCONT');
      this.isPaused = false;
      this.setStatus('RUNNING');
      this.addLog('INFO', `▶ Rclone process (PID: ${pid}) RESUMED by user (SIGCONT)`);
      return true;
    } catch (err) {
      this.addLog('ERROR', `Failed to resume rclone PID ${pid}: ${err}`);
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
    if (this.childProcess) {
      this.childProcess.kill('SIGTERM');
      this.childProcess = null;
    }
  }

  private detectLogLevel(line: string): LogLevel {
    const upper = line.toUpperCase();
    if (upper.includes('ERROR') || upper.includes('FAILED')) return 'ERROR';
    if (upper.includes('WARN') || upper.includes('WAIT')) return 'WARN';
    if (upper.includes('DONE') || upper.includes('COMPLETED') || upper.includes('SUCCESS') || upper.includes('ПОГНАЛИ'))
      return 'SUCCESS';
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
