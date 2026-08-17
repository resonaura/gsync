import { GLYPHS, THEME } from '../../utils/ansi.js';
import { visibleLength } from '../../utils/formatters.js';
import { TUIState } from '../../types.js';

export function renderKeybindingsBar(state: TUIState, width: number): string[] {
  const lines: string[] = [];
  // Left border '╰─' (2 chars) and right border '─╯' (2 chars) -> inner available is width - 4
  const innerContentWidth = Math.max(5, width - 4);

  const pauseLabel = state.status === 'PAUSED' ? 'Resume' : 'Pause';
  const allShortcuts = [
    { key: 'Space/P', desc: pauseLabel },
    { key: '↑/↓/Wheel', desc: 'Scroll' },
    { key: 'F/S', desc: state.autoScroll ? 'Lock Scroll' : 'Autoscroll' },
    { key: 'C', desc: 'Clear' },
    { key: 'H/?', desc: 'Help' },
    { key: 'Q/^C', desc: 'Quit' },
  ];

  // Dynamically include only shortcuts that fit within innerContentWidth
  const activeShortcuts: string[] = [];
  let currentLen = 1; // initial leading space

  for (const s of allShortcuts) {
    const itemStr = THEME.keyTag(s.key) + THEME.keyDesc(s.desc);
    const itemVisLen = visibleLength(itemStr) + (activeShortcuts.length > 0 ? 1 : 0);
    if (currentLen + itemVisLen <= innerContentWidth) {
      activeShortcuts.push(itemStr);
      currentLen += itemVisLen;
    }
  }

  const content = ` ${activeShortcuts.join(' ')}`;
  const padLen = Math.max(0, innerContentWidth - visibleLength(content));

  // Total visible length: 2 (left) + innerContentWidth + 2 (right) = width (EXACT)
  lines.push(
    THEME.border(GLYPHS.bl + GLYPHS.h) +
      content +
      ' '.repeat(padLen) +
      THEME.border(GLYPHS.h + GLYPHS.br)
  );

  return lines;
}
