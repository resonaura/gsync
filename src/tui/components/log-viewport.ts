import chalk from 'chalk';
import { GLYPHS, THEME } from '../../utils/ansi.js';
import { padVisible, truncateMiddle, visibleLength } from '../../utils/formatters.js';
import { LogEntry, TUIState } from '../../types.js';

export function renderLogViewport(state: TUIState, width: number, height: number): string[] {
  const lines: string[] = [];
  const innerWidth = Math.max(10, width - 2);
  const totalLogs = state.logs.length;

  // Viewport title / scroll status
  let scrollInfo = chalk.hex('#a6e3a1')('● AUTOSCROLL');
  if (!state.autoScroll) {
    const currentLine = totalLogs - state.scrollOffset;
    scrollInfo = chalk.bold.hex('#fab387')(`▲ SCROLL LOCK: ${currentLine}/${totalLogs}`);
  }

  const vpHeaderLeft = `├─${chalk.bold.hex('#cdd6f4')(' 📜 Live Transfer Logs ')}─`;
  const vpHeaderRight = `─[ ${scrollInfo} ]─┤`;
  const vpPad = Math.max(0, width - visibleLength(vpHeaderLeft) - visibleLength(vpHeaderRight));
  lines.push(THEME.border(vpHeaderLeft + GLYPHS.h.repeat(vpPad) + vpHeaderRight));

  // Determine slice of logs to display
  const effectiveHeight = Math.max(1, height - 2); // subtract borders
  let startIdx: number;

  if (state.autoScroll || state.scrollOffset === 0) {
    startIdx = Math.max(0, totalLogs - effectiveHeight);
  } else {
    const endIdx = Math.max(0, totalLogs - state.scrollOffset);
    startIdx = Math.max(0, endIdx - effectiveHeight);
  }

  const visibleLogs = state.logs.slice(startIdx, startIdx + effectiveHeight);

  // Render log rows
  for (let i = 0; i < effectiveHeight; i++) {
    const log = visibleLogs[i];
    let rowContent = '';

    if (log) {
      rowContent = formatLogRow(log, innerWidth);
    } else {
      rowContent = ' ';
    }

    lines.push(THEME.border(GLYPHS.v) + padVisible(rowContent, innerWidth) + THEME.border(GLYPHS.v));
  }

  // Bottom separator for log viewport
  lines.push(THEME.border(GLYPHS.tLeft + GLYPHS.h.repeat(innerWidth) + GLYPHS.tRight));

  return lines;
}

function formatLogRow(log: LogEntry, maxWidth: number): string {
  const time = chalk.hex('#6c7086')(`[${log.timestamp}]`);
  let badge = '';

  switch (log.level) {
    case 'ERROR':
      badge = chalk.bgHex('#f38ba8').hex('#11111b').bold(' ERR ') + ' ' + chalk.hex('#f38ba8');
      break;
    case 'WARN':
      badge = chalk.bgHex('#fab387').hex('#11111b').bold(' WRN ') + ' ' + chalk.hex('#fab387');
      break;
    case 'SUCCESS':
      badge = chalk.bgHex('#a6e3a1').hex('#11111b').bold(' OK  ') + ' ' + chalk.hex('#a6e3a1');
      break;
    case 'DEBUG':
      badge = chalk.bgHex('#45475a').hex('#cdd6f4')(' DBG ') + ' ' + chalk.hex('#6c7086');
      break;
    case 'INFO':
    default:
      badge = chalk.bgHex('#89b4fa').hex('#11111b').bold(' INF ') + ' ' + chalk.hex('#cdd6f4');
      break;
  }

  const prefix = ` ${time} ${badge}`;
  const prefixVisLen = visibleLength(prefix);
  const maxMsgLen = Math.max(5, maxWidth - prefixVisLen - 1);
  const truncatedMsg = truncateMiddle(log.message, maxMsgLen);

  return `${prefix}${truncatedMsg}`;
}
