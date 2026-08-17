import chalk from 'chalk';
import { GLYPHS, THEME } from '../../utils/ansi.js';
import { padVisible, visibleLength } from '../../utils/formatters.js';
import { TUIState } from '../../types.js';

export function renderKeybindingsBar(state: TUIState, width: number): string[] {
  const lines: string[] = [];
  const innerWidth = Math.max(10, width - 2);

  // Shortcut items (Nano style)
  const pauseLabel = state.status === 'PAUSED' ? 'Resume' : 'Pause';
  const shortcuts = [
    { key: 'Space/P', desc: pauseLabel },
    { key: '↑/↓', desc: 'Scroll' },
    { key: 'F/S', desc: state.autoScroll ? 'Lock Scroll' : 'Autoscroll' },
    { key: 'C', desc: 'Clear Logs' },
    { key: 'H/?', desc: 'Help' },
    { key: 'Q/^C', desc: 'Quit' },
  ];

  const renderedItems = shortcuts.map(
    (s) => THEME.keyTag(s.key) + THEME.keyDesc(s.desc)
  ).join(' ');

  const content = ` ${renderedItems}`;
  const pad = Math.max(0, innerWidth - visibleLength(content));

  // Bottom line of entire UI with rounded corners
  lines.push(
    THEME.border(GLYPHS.bl + GLYPHS.h) +
      content +
      ' '.repeat(pad) +
      THEME.border(GLYPHS.h + GLYPHS.br)
  );

  return lines;
}
