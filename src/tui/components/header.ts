import chalk from 'chalk';
import { GLYPHS, THEME } from '../../utils/ansi.js';
import { formatDuration, truncateMiddle, visibleLength } from '../../utils/formatters.js';
import { SyncConfig, TUIState } from '../../types.js';

export function renderHeader(state: TUIState, config: SyncConfig, width: number): string[] {
  const lines: string[] = [];
  const innerWidth = Math.max(10, width - 2);

  // Status badge
  let statusBadge = THEME.badgeRunning;
  if (state.status === 'PAUSED') statusBadge = THEME.badgePaused;
  else if (state.status === 'SCANNING') statusBadge = THEME.badgeScanning;
  else if (state.status === 'COMPLETED') statusBadge = THEME.badgeCompleted;
  else if (state.status === 'ERROR') statusBadge = THEME.badgeError;

  // Title & Mode
  const title = THEME.headerTitle(' ⚡ GSYNC ') + chalk.hex('#6c7086')('v1.0.0');
  const modeBadge = config.mode === 'daemon' ? chalk.hex('#89dceb')('[DAEMON]') : chalk.hex('#a6adc8')('[DIRECT]');
  const elapsedSecs = Math.floor((Date.now() - state.startTime) / 1000) - state.totalPausedDuration;
  const timer = chalk.hex('#a6adc8')(`⏱ ${formatDuration(Math.max(0, elapsedSecs))}`);

  // Line 1: Top border with title
  // ╭─ + title + ─ + modeBadge + ──...── + timer + ─╮
  const titlePrefix = `${GLYPHS.tl}${GLYPHS.h}`;
  const midDivider = `${GLYPHS.h}`;
  const timerSuffix = `${GLYPHS.h}${GLYPHS.tr}`;

  const fixedVisLen =
    visibleLength(titlePrefix) +
    visibleLength(title) +
    visibleLength(midDivider) +
    visibleLength(modeBadge) +
    visibleLength(timer) +
    visibleLength(timerSuffix);

  const topPad = Math.max(0, width - fixedVisLen);

  const line1 =
    THEME.border(titlePrefix) +
    title +
    THEME.border(midDivider) +
    modeBadge +
    THEME.border(GLYPHS.h.repeat(topPad)) +
    timer +
    THEME.border(timerSuffix);

  lines.push(line1);

  // Line 2: Content (Source -> Destination, Status badge, Speed)
  const maxPathLen = Math.max(8, Math.floor((innerWidth - 30) / 2));
  const sourceDest = chalk.hex('#cdd6f4')('📂 ') +
    chalk.bold.hex('#f5c2e7')(truncateMiddle(config.source, maxPathLen)) +
    chalk.hex('#6c7086')(' ➔ ') +
    chalk.bold.hex('#89b4fa')(truncateMiddle(config.remote, maxPathLen));

  const speedText = state.metrics.speed && state.metrics.speed !== '0 B/s' && state.metrics.speed !== '0B/s'
    ? chalk.bold.hex('#a6e3a1')(` 🚀 ${state.metrics.speed}`)
    : '';

  const leftContent = ` ${sourceDest}`;
  const rightContent = `${speedText}  ${statusBadge} `;
  const centerPad = Math.max(0, innerWidth - visibleLength(leftContent) - visibleLength(rightContent));

  const line2 =
    THEME.border(GLYPHS.v) +
    leftContent +
    ' '.repeat(centerPad) +
    rightContent +
    THEME.border(GLYPHS.v);

  lines.push(line2);

  return lines;
}
