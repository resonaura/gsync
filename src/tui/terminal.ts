import { ESC } from '../utils/ansi.js';

export class Terminal {
  private isRaw = false;

  public init(): void {
    if (process.stdout.isTTY) {
      process.stdout.write(ESC.enterAltScreen + ESC.hideCursor + ESC.clearScreen);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        this.isRaw = true;
      }
    }

    const cleanup = () => this.restore();
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });
    process.on('uncaughtException', (err) => {
      cleanup();
      console.error('Fatal Error:', err);
      process.exit(1);
    });
  }

  public restore(): void {
    if (process.stdout.isTTY) {
      process.stdout.write(ESC.showCursor + ESC.leaveAltScreen);
    }
    if (this.isRaw && process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch {
        /* ignore */
      }
      this.isRaw = false;
    }
  }

  public getSize(): { width: number; height: number } {
    return {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24,
    };
  }
}
