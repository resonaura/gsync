import chalk from 'chalk';

export const GLYPHS = {
  // Rounded box borders (btop / modern TUI style)
  tl: '╭',
  tr: '╮',
  bl: '╰',
  br: '╯',
  h: '─',
  v: '│',
  tLeft: '├',
  tRight: '┤',
  tTop: '┬',
  tBottom: '┴',
  cross: '┼',

  // Progress blocks (high resolution fractional blocks)
  blocks: [' ', '▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'],
  fullBlock: '█',
  emptyBlock: ' ', // Empty space instead of ░

  // Badges & icons
  bullet: '●',
  sync: '🔄',
  check: '✔',
  crossMark: '✖',
  pause: '⏸',
  running: '▶',
};

export const THEME = {
  headerBg: chalk.bgHex('#1e1e2e').hex('#cdd6f4'),
  headerTitle: chalk.bold.hex('#89b4fa'),
  badgeRunning: chalk.bold.hex('#a6e3a1')('● RUNNING'),
  badgeScanning: chalk.bold.hex('#f9e2af')('◌ SCANNING'),
  badgePaused: chalk.bold.hex('#fab387')('⏸ PAUSED'),
  badgeCompleted: chalk.bold.hex('#a6e3a1')('✔ COMPLETED'),
  badgeError: chalk.bold.hex('#f38ba8')('✖ ERROR'),

  border: chalk.hex('#45475a'),
  borderActive: chalk.hex('#89b4fa'),
  textDim: chalk.hex('#6c7086'),
  textLight: chalk.hex('#cdd6f4'),
  textMuted: chalk.hex('#a6adc8'),
  accent: chalk.hex('#89b4fa'),
  accentAlt: chalk.hex('#cba6f7'),
  success: chalk.hex('#a6e3a1'),
  warning: chalk.hex('#f9e2af'),
  danger: chalk.hex('#f38ba8'),
  info: chalk.hex('#89dceb'),

  // Keybinding bar (nano style inverted buttons)
  keyTag: (key: string) => chalk.bgHex('#cdd6f4').hex('#11111b').bold(` ${key} `),
  keyDesc: (desc: string) => chalk.hex('#cdd6f4')(` ${desc} `),
};

export const ESC = {
  enterAltScreen: '\x1b[?1049h',
  leaveAltScreen: '\x1b[?1049l',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  clearScreen: '\x1b[2J',
  cursorHome: '\x1b[H',
  cursorTo: (row: number, col: number) => `\x1b[${row};${col}H`,
  clearLine: '\x1b[2K',

  // Mouse tracking (SGR mode 1006 + normal tracking 1000/1002)
  enableMouse: '\x1b[?1000h\x1b[?1002h\x1b[?1006h',
  disableMouse: '\x1b[?1006l\x1b[?1002l\x1b[?1000l',
};
