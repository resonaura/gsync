import chalk from 'chalk';
import { GLYPHS, THEME } from '../../utils/ansi.js';
import { padVisible, visibleLength } from '../../utils/formatters.js';

export function renderHelpModal(width: number, height: number): string[] {
  const lines: string[] = [];
  const innerWidth = Math.max(10, width - 2);

  const header = `╭───${THEME.headerTitle(' GSYNC KEYBOARD SHORTCUTS & HELP ')}───`;
  const headerPad = Math.max(0, width - visibleLength(header) - 1);
  lines.push(THEME.border(header + GLYPHS.h.repeat(headerPad) + GLYPHS.tr));

  const helpItems = [
    { key: 'Space or P', desc: 'Pause / Resume the active synchronization (SIGSTOP/SIGCONT)' },
    { key: 'Mouse Wheel', desc: 'Scroll log buffer up or down smoothly' },
    { key: '↑ / ↓ (Up/Down)', desc: 'Scroll log buffer up or down line by line' },
    { key: 'PageUp / PageDown', desc: 'Scroll log buffer by 10 lines at a time' },
    { key: 'Home / End', desc: 'Jump to very top / very bottom of the log buffer' },
    { key: 'F or S', desc: 'Toggle Follow / Autoscroll mode' },
    { key: 'C', desc: 'Clear log ring buffer' },
    { key: 'H or ?', desc: 'Toggle this Help window' },
    { key: 'Q or Ctrl+C', desc: 'Exit client (background sync continues in service)' },
    { key: '', desc: '' },
    { key: 'Features:', desc: 'Excluded: /backup/cinema is permanently blocked from cloud upload' },
    { key: '', desc: 'Instant attach/detach without killing background daemon' },
    { key: '', desc: 'High-resolution fractional Unicode progress bar (█▉▊▋▌▍▎▏)' },
  ];

  for (const item of helpItems) {
    let row = '';
    if (!item.key && !item.desc) {
      row = ' ';
    } else if (!item.key) {
      row = `   ${chalk.hex('#a6adc8')(item.desc)}`;
    } else if (item.key.endsWith(':')) {
      row = ` ${chalk.bold.hex('#89b4fa')(item.key)} ${chalk.hex('#cdd6f4')(item.desc)}`;
    } else {
      row = `   ${THEME.keyTag(item.key)} ${chalk.hex('#cdd6f4')(item.desc)}`;
    }
    lines.push(THEME.border(GLYPHS.v) + padVisible(row, innerWidth) + THEME.border(GLYPHS.v));
  }

  const remaining = Math.max(1, height - lines.length - 1);
  for (let i = 0; i < remaining; i++) {
    lines.push(THEME.border(GLYPHS.v) + ' '.repeat(innerWidth) + THEME.border(GLYPHS.v));
  }

  // Footer: '╰─' (2) + innerContentWidth (width - 4) + '─╯' (2) = width
  const innerContentWidth = Math.max(5, width - 4);
  const closePrompt = ` Press ${THEME.keyTag('H')} or ${THEME.keyTag('Esc')} to close help `;
  const closePad = Math.max(0, innerContentWidth - visibleLength(closePrompt));
  lines.push(
    THEME.border(GLYPHS.bl + GLYPHS.h) +
      closePrompt +
      ' '.repeat(closePad) +
      THEME.border(GLYPHS.h + GLYPHS.br)
  );

  return lines;
}
