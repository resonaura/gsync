import chalk from 'chalk';
import { GLYPHS, THEME } from '../../utils/ansi.js';
import { formatBytes, padVisible, truncateMiddle, visibleLength } from '../../utils/formatters.js';
import { ProgressMetrics, TUIState } from '../../types.js';

export function renderProgressBar(state: TUIState, width: number): string[] {
  const lines: string[] = [];
  const innerWidth = Math.max(10, width - 2);
  const metrics = state.metrics;

  // Percentage & Stats
  const pct = Math.min(100, Math.max(0, metrics.percentage || 0));
  const pctStr = `${pct.toString().padStart(3, ' ')}%`;

  // Transferred vs Total
  const transferredStr = formatBytes(metrics.transferredBytes);
  const totalStr = metrics.totalBytes > 0 ? formatBytes(metrics.totalBytes) : 'Scanning...';
  const sizeSummary = `${transferredStr} / ${totalStr}`;

  // ETA & Files
  const etaStr = metrics.eta && metrics.eta !== '-' ? `ETA: ${metrics.eta}` : 'ETA: --:--:--';
  const fileSummary = metrics.totalFiles > 0
    ? `Files: ${metrics.filesTransferred}/${metrics.totalFiles}`
    : metrics.filesTransferred > 0
      ? `Files: ${metrics.filesTransferred}`
      : 'Files: ...';

  const checkSummary = metrics.totalChecks > 0 ? `Checks: ${metrics.checksDone}/${metrics.totalChecks}` : '';

  // 1. Active transferring file line
  const activeFile = metrics.currentFile
    ? chalk.hex('#cba6f7')(` 📄 Active: ${truncateMiddle(metrics.currentFile, innerWidth - 14)}`)
    : chalk.hex('#6c7086')(' 💤 No active file transfers in flight');

  lines.push(THEME.border(GLYPHS.v) + padVisible(activeFile, innerWidth) + THEME.border(GLYPHS.v));

  // 2. High-Resolution Unicode Progress Bar
  const barWidth = Math.max(10, innerWidth - 10);
  const exactProgress = (pct / 100) * barWidth;
  const fullBlocksCount = Math.floor(exactProgress);
  const remainder = exactProgress - fullBlocksCount;
  const fractionIndex = Math.floor(remainder * 8);

  let barContent = '';
  if (fullBlocksCount > 0) {
    barContent += chalk.bold.hex('#89b4fa')(GLYPHS.fullBlock.repeat(fullBlocksCount));
  }
  if (fullBlocksCount < barWidth && fractionIndex > 0) {
    barContent += chalk.hex('#89b4fa')(GLYPHS.blocks[fractionIndex]);
  }
  const emptyCount = Math.max(0, barWidth - fullBlocksCount - (fractionIndex > 0 ? 1 : 0));
  if (emptyCount > 0) {
    barContent += ' '.repeat(emptyCount);
  }

  const pBarInner = ` [${barContent}] ` + chalk.bold.hex(pct >= 100 ? '#a6e3a1' : '#89b4fa')(pctStr);
  lines.push(THEME.border(GLYPHS.v) + padVisible(pBarInner, innerWidth) + THEME.border(GLYPHS.v));

  // 3. Stats line (Size, Files, Checks, ETA) - dynamically fitting within innerWidth
  const rightStats = `${chalk.bold.hex('#f9e2af')(etaStr)} `;
  const rightLen = visibleLength(rightStats);

  let leftStats = ` 📊 ${chalk.bold.hex('#cdd6f4')(sizeSummary)}`;
  if (visibleLength(leftStats) + visibleLength(`  ${chalk.hex('#a6adc8')(fileSummary)}`) + rightLen + 2 <= innerWidth) {
    leftStats += `  ${chalk.hex('#a6adc8')(fileSummary)}`;
  }
  if (checkSummary && visibleLength(leftStats) + visibleLength(`  ${chalk.hex('#6c7086')(checkSummary)}`) + rightLen + 2 <= innerWidth) {
    leftStats += `  ${chalk.hex('#6c7086')(checkSummary)}`;
  }

  const statsPad = Math.max(0, innerWidth - visibleLength(leftStats) - rightLen);
  const statsLine = leftStats + ' '.repeat(statsPad) + rightStats;

  lines.push(THEME.border(GLYPHS.v) + padVisible(statsLine, innerWidth) + THEME.border(GLYPHS.v));

  return lines;
}
