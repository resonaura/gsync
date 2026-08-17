import { Command } from 'commander';
import { SyncConfig, TUIState, LogEntry, ProgressMetrics } from './types.js';
import { Terminal } from './tui/terminal.js';
import { TUIRenderer } from './tui/renderer.js';
import { InputHandler } from './tui/input-handler.js';
import { SyncRunner } from './engine/sync-runner.js';
import { ServiceWatcher } from './engine/service-watcher.js';
import { spawn, execSync } from 'child_process';
import fs from 'fs';

const program = new Command();

program
  .name('gsync')
  .description('⚡ High-performance interactive TUI for Google Drive and rsync/rclone synchronization')
  .version('1.0.0')
  .option('-s, --source <path>', 'Source directory to sync', '/mnt/backup')
  .option('-r, --remote <remote>', 'Target remote path', 'gdrive:Sync/Backup')
  .option('-e, --exclude-file <path>', 'Path to rclone exclude file', '/home/resonaura/rclone-exclude.txt')
  .option('-b, --bwlimit <limit>', 'Bandwidth limit', '15M')
  .option('-t, --transfers <number>', 'Number of parallel transfers', '2')
  .option('-c, --checkers <number>', 'Number of checkers', '4')
  .option('--direct', 'Force direct sync process instead of attaching to service', false)
  .action((options) => {
    runApp({
      source: options.source,
      remote: options.remote,
      excludeFile: options.excludeFile,
      bwlimit: options.bwlimit,
      transfers: parseInt(options.transfers, 10),
      checkers: parseInt(options.checkers, 10),
      mode: options.direct ? 'direct' : 'daemon',
    });
  });

program
  .command('daemon')
  .description('Run headless background watcher daemon for automated sync')
  .option('-s, --source <path>', 'Source directory to sync', '/mnt/backup')
  .option('-r, --remote <remote>', 'Target remote path', 'gdrive:Sync/Backup')
  .option('-e, --exclude-file <path>', 'Path to rclone exclude file', '/home/resonaura/rclone-exclude.txt')
  .action((options) => {
    runDaemon({
      source: options.source,
      remote: options.remote,
      excludeFile: options.excludeFile,
      mode: 'direct',
    });
  });

program
  .command('service <action>')
  .description('Manage systemd background service (status, restart, stop, logs)')
  .action((action) => {
    switch (action) {
      case 'status':
        try {
          execSync('systemctl status gsync.service --no-pager', { stdio: 'inherit' });
        } catch {
          /* ignore */
        }
        break;
      case 'restart':
        try {
          execSync('systemctl restart gsync.service', { stdio: 'inherit' });
          console.log('✅ gsync.service restarted.');
        } catch (e) {
          console.error('Failed to restart service:', e);
        }
        break;
      case 'stop':
        try {
          execSync('systemctl stop gsync.service', { stdio: 'inherit' });
          console.log('🛑 gsync.service stopped.');
        } catch (e) {
          console.error('Failed to stop service:', e);
        }
        break;
      case 'logs':
        try {
          execSync('journalctl -u gsync.service -n 50 --no-pager', { stdio: 'inherit' });
        } catch {
          /* ignore */
        }
        break;
      default:
        console.log('Unknown action. Available: status, restart, stop, logs');
    }
  });

program.parse(process.argv);

function runApp(config: SyncConfig): void {
  const terminal = new Terminal();
  const renderer = new TUIRenderer();

  const state: TUIState = {
    status: 'SCANNING',
    metrics: {
      percentage: 0,
      transferredBytes: 0,
      totalBytes: 0,
      speed: '0 B/s',
      speedBytesPerSec: 0,
      eta: '--:--:--',
      currentFile: '',
      filesTransferred: 0,
      totalFiles: 0,
      checksDone: 0,
      totalChecks: 0,
      errorsCount: 0,
      elapsedSeconds: 0,
    },
    logs: [],
    scrollOffset: 0,
    autoScroll: true,
    activeView: 'main',
    startTime: Date.now(),
    totalPausedDuration: 0,
  };

  // Determine whether to attach to background service or run direct
  let engine: SyncRunner | ServiceWatcher;
  const watcher = new ServiceWatcher('gsync.service');
  const oldWatcher = new ServiceWatcher('gdrive-sync.service');

  if (config.mode === 'daemon' && (watcher.isServiceActive() || oldWatcher.isServiceActive())) {
    config.mode = 'daemon';
    engine = watcher.isServiceActive() ? watcher : oldWatcher;
  } else {
    config.mode = 'direct';
    engine = new SyncRunner(config);
  }

  terminal.init();

  // Wire engine events to TUI state
  engine.on('status', (newStatus) => {
    state.status = newStatus;
  });

  engine.on('metrics', (newMetrics: ProgressMetrics) => {
    state.metrics = { ...state.metrics, ...newMetrics };
  });

  engine.on('log', (entry: LogEntry) => {
    state.logs.push(entry);
    if (state.logs.length > 2000) {
      state.logs.shift();
    }
  });

  // Setup Keybindings
  const inputHandler = new InputHandler({
    onTogglePause: () => {
      engine.togglePause();
    },
    onScrollUp: (amount: number) => {
      state.autoScroll = false;
      state.scrollOffset = Math.min(state.logs.length, state.scrollOffset + amount);
    },
    onScrollDown: (amount: number) => {
      state.scrollOffset = Math.max(0, state.scrollOffset - amount);
      if (state.scrollOffset === 0) state.autoScroll = true;
    },
    onScrollTop: () => {
      state.autoScroll = false;
      state.scrollOffset = state.logs.length;
    },
    onScrollBottom: () => {
      state.autoScroll = true;
      state.scrollOffset = 0;
    },
    onToggleAutoScroll: () => {
      state.autoScroll = !state.autoScroll;
      if (state.autoScroll) state.scrollOffset = 0;
    },
    onClearLogs: () => {
      state.logs = [];
      state.scrollOffset = 0;
      state.autoScroll = true;
    },
    onToggleHelp: () => {
      state.activeView = state.activeView === 'help' ? 'main' : 'help';
    },
    onCloseHelp: () => {
      if (state.activeView === 'help') {
        state.activeView = 'main';
      }
    },
    onQuit: () => {
      cleanupAndExit(0);
    },
  });

  if (process.stdin.isTTY) {
    process.stdin.on('data', (data: Buffer) => {
      inputHandler.handleInput(data.toString());
    });
  }

  // Start engine
  engine.start();

  // Render loop (100ms / 10 FPS)
  const renderInterval = setInterval(() => {
    const { width, height } = terminal.getSize();
    renderer.render(state, config, width, height);
  }, 100);

  function cleanupAndExit(code: number): void {
    clearInterval(renderInterval);
    engine.stop();
    terminal.restore();
    process.exit(code);
  }
}

function runDaemon(config: SyncConfig): void {
  console.log(`[Daemon] 🚀 GSYNC daemon started for ${config.source} -> ${config.remote}`);

  let isSyncing = false;
  let pendingSync = false;

  const triggerSync = () => {
    if (isSyncing) {
      pendingSync = true;
      return;
    }

    isSyncing = true;
    console.log(`[Daemon] 📤 [${new Date().toLocaleTimeString()}] Starting synchronization cycle...`);

    const runner = new SyncRunner(config);
    runner.on('log', (log) => {
      console.log(`[${log.timestamp}] [${log.level}] ${log.message}`);
    });
    runner.on('metrics', (metrics) => {
      if (metrics.percentage > 0) {
        console.log(`[Progress] ${metrics.percentage}% | ${metrics.speed} | ETA: ${metrics.eta} | Files: ${metrics.filesTransferred}/${metrics.totalFiles}`);
      }
    });
    runner.on('exit', () => {
      isSyncing = false;
      console.log(`[Daemon] 😴 Synchronization cycle finished. Watching for new changes...`);
      if (pendingSync) {
        pendingSync = false;
        setTimeout(triggerSync, 5000);
      }
    });

    runner.start();
  };

  // Initial sync
  triggerSync();

  // Watch directory using inotifywait if available, or polling
  try {
    const inotify = spawn('inotifywait', [
      '-m',
      '-r',
      '-e', 'close_write,move,create,delete',
      '--exclude', '(cinema|\\.tmp|\\._*|node_modules|\\.git)',
      config.source,
    ]);

    let debounceTimer: NodeJS.Timeout | null = null;

    inotify.stdout.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (!line) return;

      console.log(`[Daemon] 👀 Change detected: ${line.split(' ').slice(2).join(' ')}`);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`[Daemon] ⏱ Debounce finished, triggering sync...`);
        triggerSync();
      }, 15000);
    });

    inotify.on('error', () => {
      console.warn('[Daemon] inotifywait not found, running scheduled sync every 10 minutes.');
      setInterval(triggerSync, 10 * 60 * 1000);
    });
  } catch {
    console.warn('[Daemon] Fallback: running scheduled sync every 10 minutes.');
    setInterval(triggerSync, 10 * 60 * 1000);
  }
}
