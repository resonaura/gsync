import { Command } from 'commander';
import { SyncConfig, TUIState, LogEntry, ProgressMetrics } from './types.js';
import { Terminal } from './tui/terminal.js';
import { TUIRenderer } from './tui/renderer.js';
import { InputHandler } from './tui/input-handler.js';
import { SyncRunner } from './engine/sync-runner.js';
import { ServiceWatcher } from './engine/service-watcher.js';

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
  const watcher = new ServiceWatcher('gdrive-sync.service');

  if (config.mode === 'daemon' && watcher.isServiceActive()) {
    config.mode = 'daemon';
    engine = watcher;
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
    // Keep max 2000 lines in ring buffer
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
