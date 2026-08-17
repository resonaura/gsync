import chalk from 'chalk';
import { GLYPHS, THEME } from '../../utils/ansi.js';
import { padVisible, truncateMiddle, visibleLength } from '../../utils/formatters.js';
import { LogEntry, TUIState } from '../../types.js';

export function renderLogViewport(state: TUIState, width: number, effectiveRows: number): string[] {
  const lines: string[] = [];
  const innerWidth = Math.max(10, width - 2);
  const totalLogs = state.logs.length;

  // Viewport title / scroll status
  let scrollInfo = chalk.hex('#a6e3a1')('● AUTOSCROLL');
  if (!state.autoScroll) {
    const currentLine = Math.max(1, totalLogs - state.scrollOffset);
    scrollInfo = chalk.bold.hex('#fab387')(`▲ SCROLL LOCK: ${currentLine}/${totalLogs}`);
  }

  // 1. Top border connected seamlessly with Header
  const vpHeaderLeft = `├─${chalk.bold.hex('#cdd6f4')(' 📜 Live Transfer Logs ')}─`;
  const vpHeaderRight = `─[ ${scrollInfo} ]─┤`;
  const vpPad = Math.max(0, width - visibleLength(vpHeaderLeft) - visibleLength(vpHeaderRight));
  lines.push(THEME.border(vpHeaderLeft + GLYPHS.h.repeat(vpPad) + vpHeaderRight));

  // Determine slice of logs to display
  let startIdx: number;
  if (state.autoScroll || state.scrollOffset === 0) {
    startIdx = Math.max(0, totalLogs - effectiveRows);
  } else {
    const endIdx = Math.max(0, totalLogs - state.scrollOffset);
    startIdx = Math.max(0, endIdx - effectiveRows);
  }

  const visibleLogs = state.logs.slice(startIdx, startIdx + effectiveRows);

  // 2. Render log rows
  for (let i = 0; i < effectiveRows; i++) {
    const log = visibleLogs[i];
    let rowContent = ' ';

    if (log) {
      rowContent = formatLogRow(log, innerWidth);
    }

    lines.push(THEME.border(GLYPHS.v) + padVisible(rowContent, innerWidth) + THEME.border(GLYPHS.v));
  }

  // 3. Bottom separator between Log Viewport and Progress Bar
  lines.push(THEME.border(GLYPHS.tLeft + GLYPHS.h.repeat(innerWidth) + GLYPHS.tRight));

  return lines;
}

function formatLogRow(log: LogEntry, maxWidth: number): string {
  const time = chalk.hex('#6c7086')(`[${log.timestamp}]`);
  let badge = '';
  let msgColor: (text: string) => string;

  switch (log.level) {
    case 'ERROR':
      badge = chalk.bgHex('#f38ba8').hex('#11111b').bold(' ERR ');
      msgColor = chalk.hex('#f38ba8');
      break;
    case 'WARN':
      badge = chalk.bgHex('#fab387').hex('#11111b').bold(' WRN ');
      msgColor = chalk.hex('#fab387');
      break;
    case 'SUCCESS':
      badge = chalk.bgHex('#a6e3a1').hex('#11111b').bold(' OK  ');
      msgColor = chalk.hex('#a6e3a1');
      break;
    case 'DEBUG':
      badge = chalk.bgHex('#45475a').hex('#cdd6f4')(' DBG ');
      msgColor = chalk.hex('#6c7086');
      break;
    case 'INFO':
    default:
      badge = chalk.bgHex('#89b4fa').hex('#11111b').bold(' INF ');
      msgColor = chalk.hex('#cdd6f4');
      break;
  }

  const prefix = ` ${time} ${badge} `;
  const prefixVisLen = visibleLength(prefix);
  const maxMsgLen = Math.max(5, maxWidth - prefixVisLen - 1);
  const cleanMessage = cleanLogMessage(log.message);
  const truncatedMsg = truncateMiddle(cleanMessage, maxMsgLen);

  return `${prefix}${msgColor(truncatedMsg)}`;
}

function cleanLogMessage(str: string): string {
  return str
    // Strip journalctl and systemd timestamps e.g. [8:17:35 AM]
    .replace(/^\[\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?\]\s*/i, '')
    // Strip [INFO] / [ERROR] / [WARN] brackets
    .replace(/^\[(INFO|NOTICE|DEBUG|WARN|ERROR)\]\s*/i, '')
    // Strip rclone priority codes <6>INFO :
    .replace(/^<\d+>(INFO|NOTICE|DEBUG|WARN|ERROR)\s*:\s*/i, '')
    // Strip rclone date timestamp 2026/08/17 08:14:34 INFO :
    .replace(/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+(INFO|NOTICE|DEBUG|WARN|ERROR)\s*:\s*/i, '')
    .trim();
}
