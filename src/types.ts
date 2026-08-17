export type SyncStatus =
  | 'IDLE'
  | 'SCANNING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ERROR';

export interface ProgressMetrics {
  percentage: number;
  transferredBytes: number;
  totalBytes: number;
  speed: string;
  speedBytesPerSec: number;
  eta: string;
  currentFile: string;
  filesTransferred: number;
  totalFiles: number;
  checksDone: number;
  totalChecks: number;
  errorsCount: number;
  elapsedSeconds: number;
}

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SUCCESS';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  raw: string;
}

export interface SyncConfig {
  source: string;
  remote: string;
  excludeFile?: string;
  excludes?: string[];
  bwlimit?: string;
  transfers?: number;
  checkers?: number;
  mode: 'direct' | 'daemon';
  serviceName?: string;
}

export interface TUIState {
  status: SyncStatus;
  metrics: ProgressMetrics;
  logs: LogEntry[];
  scrollOffset: number; // 0 means bottom (auto-scroll)
  autoScroll: boolean;
  activeView: 'main' | 'help';
  startTime: number;
  pauseTime?: number;
  totalPausedDuration: number;
  errorMessage?: string;
  pid?: number;
}
