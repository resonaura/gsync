#!/usr/bin/env node


// src/index.ts
import { Command } from "commander";

// src/utils/ansi.ts
import chalk from "chalk";
var GLYPHS = {
  // Rounded box borders (btop / modern TUI style)
  tl: "\u256D",
  tr: "\u256E",
  bl: "\u2570",
  br: "\u256F",
  h: "\u2500",
  v: "\u2502",
  tLeft: "\u251C",
  tRight: "\u2524",
  tTop: "\u252C",
  tBottom: "\u2534",
  cross: "\u253C",
  // Progress blocks (high resolution fractional blocks)
  blocks: [" ", "\u258F", "\u258E", "\u258D", "\u258C", "\u258B", "\u258A", "\u2589", "\u2588"],
  fullBlock: "\u2588",
  emptyBlock: " ",
  // Empty space instead of ░
  // Badges & icons
  bullet: "\u25CF",
  sync: "\u{1F504}",
  check: "\u2714",
  crossMark: "\u2716",
  pause: "\u23F8",
  running: "\u25B6"
};
var THEME = {
  headerBg: chalk.bgHex("#1e1e2e").hex("#cdd6f4"),
  headerTitle: chalk.bold.hex("#89b4fa"),
  badgeRunning: chalk.bold.hex("#a6e3a1")("\u25CF RUNNING"),
  badgeScanning: chalk.bold.hex("#f9e2af")("\u25CC SCANNING"),
  badgePaused: chalk.bold.hex("#fab387")("\u23F8 PAUSED"),
  badgeCompleted: chalk.bold.hex("#a6e3a1")("\u2714 COMPLETED"),
  badgeError: chalk.bold.hex("#f38ba8")("\u2716 ERROR"),
  border: chalk.hex("#45475a"),
  borderActive: chalk.hex("#89b4fa"),
  textDim: chalk.hex("#6c7086"),
  textLight: chalk.hex("#cdd6f4"),
  textMuted: chalk.hex("#a6adc8"),
  accent: chalk.hex("#89b4fa"),
  accentAlt: chalk.hex("#cba6f7"),
  success: chalk.hex("#a6e3a1"),
  warning: chalk.hex("#f9e2af"),
  danger: chalk.hex("#f38ba8"),
  info: chalk.hex("#89dceb"),
  // Keybinding bar (nano style inverted buttons)
  keyTag: (key) => chalk.bgHex("#cdd6f4").hex("#11111b").bold(` ${key} `),
  keyDesc: (desc) => chalk.hex("#cdd6f4")(` ${desc} `)
};
var ESC = {
  enterAltScreen: "\x1B[?1049h",
  leaveAltScreen: "\x1B[?1049l",
  hideCursor: "\x1B[?25l",
  showCursor: "\x1B[?25h",
  clearScreen: "\x1B[2J",
  cursorHome: "\x1B[H",
  cursorTo: (row, col) => `\x1B[${row};${col}H`,
  clearLine: "\x1B[2K",
  // Mouse tracking (SGR mode 1006 + normal tracking 1000/1002)
  enableMouse: "\x1B[?1000h\x1B[?1002h\x1B[?1006h",
  disableMouse: "\x1B[?1006l\x1B[?1002l\x1B[?1000l"
};

// src/tui/terminal.ts
var Terminal = class {
  isRaw = false;
  init() {
    if (process.stdout.isTTY) {
      process.stdout.write(
        ESC.enterAltScreen + ESC.hideCursor + ESC.enableMouse + ESC.clearScreen
      );
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        this.isRaw = true;
      }
    }
    const cleanup = () => this.restore();
    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      cleanup();
      process.exit(0);
    });
    process.on("uncaughtException", (err) => {
      cleanup();
      console.error("Fatal Error:", err);
      process.exit(1);
    });
  }
  restore() {
    if (process.stdout.isTTY) {
      process.stdout.write(ESC.disableMouse + ESC.showCursor + ESC.leaveAltScreen);
    }
    if (this.isRaw && process.stdin.isTTY) {
      try {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      } catch {
      }
      this.isRaw = false;
    }
  }
  getSize() {
    return {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24
    };
  }
};

// src/tui/components/header.ts
import chalk2 from "chalk";

// src/utils/formatters.ts
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  if (i >= sizes.length) return `${(bytes / Math.pow(k, sizes.length - 1)).toFixed(dm)} ${sizes[sizes.length - 1]}`;
  return `${(bytes / Math.pow(k, i)).toFixed(dm)} ${sizes[i]}`;
}
function parseBytes(str) {
  if (!str) return 0;
  const match = str.trim().match(/^([\d.,]+)\s*([a-zA-Z]*)$/);
  if (!match) return 0;
  const val = parseFloat(match[1].replace(/,/g, ""));
  const unit = (match[2] || "").toUpperCase();
  switch (unit) {
    case "K":
    case "KB":
    case "KIB":
      return val * 1024;
    case "M":
    case "MB":
    case "MIB":
      return val * 1024 * 1024;
    case "G":
    case "GB":
    case "GIB":
      return val * 1024 * 1024 * 1024;
    case "T":
    case "TB":
    case "TIB":
      return val * 1024 * 1024 * 1024 * 1024;
    case "B":
    default:
      return val;
  }
}
function formatDuration(seconds) {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "--:--:--";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor(seconds % 3600 / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
function truncateMiddle(str, maxLength) {
  if (!str || str.length <= maxLength) return str || "";
  if (maxLength <= 5) return str.slice(0, maxLength);
  const half = Math.floor((maxLength - 3) / 2);
  return `${str.slice(0, half)}...${str.slice(str.length - (maxLength - 3 - half))}`;
}
function stripAnsi(str) {
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}
function visibleLength(str) {
  return stripAnsi(str).length;
}
function padVisible(str, targetLen, char = " ") {
  const vis = visibleLength(str);
  if (vis >= targetLen) return str;
  return str + char.repeat(targetLen - vis);
}

// src/tui/components/header.ts
function renderHeader(state, config, width) {
  const lines = [];
  const innerWidth = Math.max(10, width - 2);
  let statusBadge = THEME.badgeRunning;
  if (state.status === "PAUSED") statusBadge = THEME.badgePaused;
  else if (state.status === "SCANNING") statusBadge = THEME.badgeScanning;
  else if (state.status === "COMPLETED") statusBadge = THEME.badgeCompleted;
  else if (state.status === "ERROR") statusBadge = THEME.badgeError;
  const title = THEME.headerTitle(" \u26A1 GSYNC ") + chalk2.hex("#6c7086")("v1.0.0");
  const modeBadge = config.mode === "daemon" ? chalk2.hex("#89dceb")("[SERVICE ATTACHED]") : chalk2.hex("#a6adc8")("[DIRECT SYNC]");
  const elapsedSecs = Math.floor((Date.now() - state.startTime) / 1e3) - state.totalPausedDuration;
  const timer = chalk2.hex("#a6adc8")(`\u23F1 ${formatDuration(Math.max(0, elapsedSecs))}`);
  const topHeaderTitle = `\u256D\u2500${title}\u2500${modeBadge}\u2500`;
  const topHeaderRight = `\u2500${timer}\u2500\u256E`;
  const topPad = Math.max(0, width - visibleLength(topHeaderTitle) - visibleLength(topHeaderRight));
  lines.push(THEME.border(topHeaderTitle + GLYPHS.h.repeat(topPad) + topHeaderRight));
  const sourceDest = chalk2.hex("#cdd6f4")("\u{1F4C2} ") + chalk2.bold.hex("#f5c2e7")(truncateMiddle(config.source, 25)) + chalk2.hex("#6c7086")(" \u2794 ") + chalk2.bold.hex("#89b4fa")(truncateMiddle(config.remote, 25));
  const speedText = state.metrics.speed && state.metrics.speed !== "0 B/s" ? chalk2.bold.hex("#a6e3a1")(` \u{1F680} ${state.metrics.speed}`) : "";
  const leftContent = ` ${sourceDest}`;
  const rightContent = `${speedText}  ${statusBadge} `;
  const centerPad = Math.max(1, innerWidth - visibleLength(leftContent) - visibleLength(rightContent));
  lines.push(
    THEME.border(GLYPHS.v) + leftContent + " ".repeat(centerPad) + rightContent + THEME.border(GLYPHS.v)
  );
  lines.push(THEME.border(GLYPHS.tLeft + GLYPHS.h.repeat(innerWidth) + GLYPHS.tRight));
  return lines;
}

// src/tui/components/log-viewport.ts
import chalk3 from "chalk";
function renderLogViewport(state, width, height) {
  const lines = [];
  const innerWidth = Math.max(10, width - 2);
  const totalLogs = state.logs.length;
  let scrollInfo = chalk3.hex("#a6e3a1")("\u25CF AUTOSCROLL");
  if (!state.autoScroll) {
    const currentLine = Math.max(1, totalLogs - state.scrollOffset);
    scrollInfo = chalk3.bold.hex("#fab387")(`\u25B2 SCROLL LOCK: ${currentLine}/${totalLogs}`);
  }
  const vpHeaderLeft = `\u251C\u2500${chalk3.bold.hex("#cdd6f4")(" \u{1F4DC} Live Transfer Logs ")}\u2500`;
  const vpHeaderRight = `\u2500[ ${scrollInfo} ]\u2500\u2524`;
  const vpPad = Math.max(0, width - visibleLength(vpHeaderLeft) - visibleLength(vpHeaderRight));
  lines.push(THEME.border(vpHeaderLeft + GLYPHS.h.repeat(vpPad) + vpHeaderRight));
  const effectiveHeight = Math.max(1, height - 2);
  let startIdx;
  if (state.autoScroll || state.scrollOffset === 0) {
    startIdx = Math.max(0, totalLogs - effectiveHeight);
  } else {
    const endIdx = Math.max(0, totalLogs - state.scrollOffset);
    startIdx = Math.max(0, endIdx - effectiveHeight);
  }
  const visibleLogs = state.logs.slice(startIdx, startIdx + effectiveHeight);
  for (let i = 0; i < effectiveHeight; i++) {
    const log = visibleLogs[i];
    let rowContent = "";
    if (log) {
      rowContent = formatLogRow(log, innerWidth);
    } else {
      rowContent = " ";
    }
    lines.push(THEME.border(GLYPHS.v) + padVisible(rowContent, innerWidth) + THEME.border(GLYPHS.v));
  }
  lines.push(THEME.border(GLYPHS.tLeft + GLYPHS.h.repeat(innerWidth) + GLYPHS.tRight));
  return lines;
}
function formatLogRow(log, maxWidth) {
  const time = chalk3.hex("#6c7086")(`[${log.timestamp}]`);
  let badge = "";
  let msgColor;
  switch (log.level) {
    case "ERROR":
      badge = chalk3.bgHex("#f38ba8").hex("#11111b").bold(" ERR ");
      msgColor = chalk3.hex("#f38ba8");
      break;
    case "WARN":
      badge = chalk3.bgHex("#fab387").hex("#11111b").bold(" WRN ");
      msgColor = chalk3.hex("#fab387");
      break;
    case "SUCCESS":
      badge = chalk3.bgHex("#a6e3a1").hex("#11111b").bold(" OK  ");
      msgColor = chalk3.hex("#a6e3a1");
      break;
    case "DEBUG":
      badge = chalk3.bgHex("#45475a").hex("#cdd6f4")(" DBG ");
      msgColor = chalk3.hex("#6c7086");
      break;
    case "INFO":
    default:
      badge = chalk3.bgHex("#89b4fa").hex("#11111b").bold(" INF ");
      msgColor = chalk3.hex("#cdd6f4");
      break;
  }
  const prefix = ` ${time} ${badge} `;
  const prefixVisLen = visibleLength(prefix);
  const maxMsgLen = Math.max(5, maxWidth - prefixVisLen - 1);
  const cleanMessage = stripInternalNoise(log.message);
  const truncatedMsg = truncateMiddle(cleanMessage, maxMsgLen);
  return `${prefix}${msgColor(truncatedMsg)}`;
}
function stripInternalNoise(str) {
  return str.replace(/^<\d+>(INFO|NOTICE|DEBUG|WARN|ERROR)\s*:\s*/i, "").replace(/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+(INFO|NOTICE|DEBUG|WARN|ERROR)\s*:\s*/i, "");
}

// src/tui/components/progress-bar.ts
import chalk4 from "chalk";
function renderProgressBar(state, width) {
  const lines = [];
  const innerWidth = Math.max(10, width - 2);
  const metrics = state.metrics;
  const pct = Math.min(100, Math.max(0, metrics.percentage || 0));
  const pctStr = `${pct.toString().padStart(3, " ")}%`;
  const transferredStr = formatBytes(metrics.transferredBytes);
  const totalStr = metrics.totalBytes > 0 ? formatBytes(metrics.totalBytes) : "Scanning...";
  const sizeSummary = `${transferredStr} / ${totalStr}`;
  const etaStr = metrics.eta && metrics.eta !== "-" ? `ETA: ${metrics.eta}` : "ETA: --:--:--";
  const fileSummary = metrics.totalFiles > 0 ? `Files: ${metrics.filesTransferred}/${metrics.totalFiles}` : metrics.filesTransferred > 0 ? `Files: ${metrics.filesTransferred}` : "Files: ...";
  const checkSummary = metrics.totalChecks > 0 ? `Checks: ${metrics.checksDone}/${metrics.totalChecks}` : "";
  const activeFile = metrics.currentFile ? chalk4.hex("#cba6f7")(` \u{1F4C4} Active: ${truncateMiddle(metrics.currentFile, innerWidth - 12)}`) : chalk4.hex("#6c7086")(" \u{1F4A4} No active file transfers in flight");
  const activeLine = THEME.border(GLYPHS.v) + padVisible(activeFile, innerWidth) + THEME.border(GLYPHS.v);
  lines.push(activeLine);
  const barWidth = Math.max(10, innerWidth - 12);
  const exactProgress = pct / 100 * barWidth;
  const fullBlocksCount = Math.floor(exactProgress);
  const remainder = exactProgress - fullBlocksCount;
  const fractionIndex = Math.floor(remainder * 8);
  let barContent = "";
  if (fullBlocksCount > 0) {
    barContent += chalk4.bold.hex("#89b4fa")(GLYPHS.fullBlock.repeat(fullBlocksCount));
  }
  if (fullBlocksCount < barWidth && fractionIndex > 0) {
    barContent += chalk4.hex("#89b4fa")(GLYPHS.blocks[fractionIndex]);
  }
  const emptyCount = Math.max(0, barWidth - fullBlocksCount - (fractionIndex > 0 ? 1 : 0));
  if (emptyCount > 0) {
    barContent += " ".repeat(emptyCount);
  }
  const pBarLine = ` [${barContent}] ` + chalk4.bold.hex(pct >= 100 ? "#a6e3a1" : "#89b4fa")(pctStr);
  lines.push(THEME.border(GLYPHS.v) + padVisible(` ${pBarLine}`, innerWidth) + THEME.border(GLYPHS.v));
  const leftStats = ` \u{1F4CA} ${chalk4.bold.hex("#cdd6f4")(sizeSummary)}  ${chalk4.hex("#a6adc8")(fileSummary)}  ${chalk4.hex("#6c7086")(checkSummary)}`;
  const rightStats = `${chalk4.bold.hex("#f9e2af")(etaStr)} `;
  const statsPad = Math.max(1, innerWidth - visibleLength(leftStats) - visibleLength(rightStats));
  lines.push(
    THEME.border(GLYPHS.v) + leftStats + " ".repeat(statsPad) + rightStats + THEME.border(GLYPHS.v)
  );
  return lines;
}

// src/tui/components/keybindings-bar.ts
function renderKeybindingsBar(state, width) {
  const lines = [];
  const innerWidth = Math.max(10, width - 2);
  const pauseLabel = state.status === "PAUSED" ? "Resume" : "Pause";
  const shortcuts = [
    { key: "Space/P", desc: pauseLabel },
    { key: "\u2191/\u2193", desc: "Scroll" },
    { key: "F/S", desc: state.autoScroll ? "Lock Scroll" : "Autoscroll" },
    { key: "C", desc: "Clear Logs" },
    { key: "H/?", desc: "Help" },
    { key: "Q/^C", desc: "Quit" }
  ];
  const renderedItems = shortcuts.map(
    (s) => THEME.keyTag(s.key) + THEME.keyDesc(s.desc)
  ).join(" ");
  const content = ` ${renderedItems}`;
  const pad = Math.max(0, innerWidth - visibleLength(content));
  lines.push(
    THEME.border(GLYPHS.bl + GLYPHS.h) + content + " ".repeat(pad) + THEME.border(GLYPHS.h + GLYPHS.br)
  );
  return lines;
}

// src/tui/components/help-modal.ts
import chalk5 from "chalk";
function renderHelpModal(width, height) {
  const lines = [];
  const innerWidth = Math.max(10, width - 2);
  const header = `\u256D\u2500\u2500\u2500${THEME.headerTitle(" GSYNC KEYBOARD SHORTCUTS & HELP ")}\u2500\u2500\u2500`;
  const headerPad = Math.max(0, width - visibleLength(header) - 1);
  lines.push(THEME.border(header + GLYPHS.h.repeat(headerPad) + GLYPHS.tr));
  const helpItems = [
    { key: "Space or P", desc: "Pause / Resume the active synchronization (SIGSTOP/SIGCONT)" },
    { key: "\u2191 / \u2193 (Up/Down)", desc: "Scroll log buffer up or down line by line" },
    { key: "PageUp / PageDown", desc: "Scroll log buffer by 10 lines at a time" },
    { key: "Home / End", desc: "Jump to very top / very bottom of the log buffer" },
    { key: "F or S", desc: "Toggle Follow / Autoscroll mode" },
    { key: "C", desc: "Clear log ring buffer" },
    { key: "H or ?", desc: "Toggle this Help window" },
    { key: "Q or Ctrl+C", desc: "Safely terminate process and exit TUI" },
    { key: "", desc: "" },
    { key: "Features:", desc: "Excluded path: /backup/cinema is permanently blocked from upload" },
    { key: "", desc: "Direct memory buffer streams with zero disk latency" },
    { key: "", desc: "High-resolution fractional Unicode progress bar (\u2588\u2589\u258A\u258B\u258C\u258D\u258E\u258F)" }
  ];
  for (const item of helpItems) {
    let row = "";
    if (!item.key && !item.desc) {
      row = " ";
    } else if (!item.key) {
      row = `   ${chalk5.hex("#a6adc8")(item.desc)}`;
    } else if (item.key.endsWith(":")) {
      row = ` ${chalk5.bold.hex("#89b4fa")(item.key)} ${chalk5.hex("#cdd6f4")(item.desc)}`;
    } else {
      row = `   ${THEME.keyTag(item.key)} ${chalk5.hex("#cdd6f4")(item.desc)}`;
    }
    lines.push(THEME.border(GLYPHS.v) + padVisible(row, innerWidth) + THEME.border(GLYPHS.v));
  }
  const remaining = Math.max(1, height - lines.length - 1);
  for (let i = 0; i < remaining; i++) {
    lines.push(THEME.border(GLYPHS.v) + " ".repeat(innerWidth) + THEME.border(GLYPHS.v));
  }
  const closePrompt = ` Press ${THEME.keyTag("H")} or ${THEME.keyTag("Esc")} to close help `;
  const closePad = Math.max(0, innerWidth - visibleLength(closePrompt));
  lines.push(
    THEME.border(GLYPHS.bl + GLYPHS.h) + closePrompt + " ".repeat(closePad) + THEME.border(GLYPHS.h + GLYPHS.br)
  );
  return lines;
}

// src/tui/renderer.ts
var TUIRenderer = class {
  lastRenderOutput = "";
  render(state, config, width, height) {
    if (width < 30 || height < 12) {
      this.renderSmallScreenWarning(width, height);
      return;
    }
    if (state.activeView === "help") {
      const helpLines = renderHelpModal(width, height);
      this.writeBuffer(helpLines, height);
      return;
    }
    const headerLines = renderHeader(state, config, width);
    const progressBarLines = renderProgressBar(state, width);
    const footerLines = renderKeybindingsBar(state, width);
    const reservedHeight = headerLines.length + progressBarLines.length + footerLines.length;
    const viewportHeight = Math.max(3, height - reservedHeight);
    const logLines = renderLogViewport(state, width, viewportHeight);
    const fullScreenLines = [
      ...headerLines,
      ...logLines,
      ...progressBarLines,
      ...footerLines
    ];
    this.writeBuffer(fullScreenLines, height);
  }
  writeBuffer(lines, maxRows) {
    const cropped = lines.slice(0, maxRows);
    const output = ESC.cursorHome + cropped.join("\n");
    if (output !== this.lastRenderOutput) {
      process.stdout.write(output);
      this.lastRenderOutput = output;
    }
  }
  renderSmallScreenWarning(width, height) {
    const msg = `Terminal too small: ${width}x${height} (Min: 30x12)`;
    process.stdout.write(ESC.cursorHome + msg);
  }
};

// src/tui/input-handler.ts
var InputHandler = class {
  actions;
  constructor(actions) {
    this.actions = actions;
  }
  handleInput(key) {
    if (/\x1b\[<64;\d+;\d+[Mm]/.test(key)) {
      this.actions.onScrollUp(3);
      return;
    }
    if (/\x1b\[<65;\d+;\d+[Mm]/.test(key)) {
      this.actions.onScrollDown(3);
      return;
    }
    if (key.startsWith("\x1B[M")) {
      const b = key.charCodeAt(3) - 32;
      if (b === 64) {
        this.actions.onScrollUp(3);
        return;
      } else if (b === 65) {
        this.actions.onScrollDown(3);
        return;
      }
    }
    if (key === "" || key === "q" || key === "Q") {
      this.actions.onQuit();
      return;
    }
    if (key === "\x1B") {
      this.actions.onCloseHelp();
      return;
    }
    if (key === " " || key === "p" || key === "P") {
      this.actions.onTogglePause();
      return;
    }
    if (key === "\x1B[A" || key === "k") {
      this.actions.onScrollUp(1);
      return;
    }
    if (key === "\x1B[B" || key === "j") {
      this.actions.onScrollDown(1);
      return;
    }
    if (key === "\x1B[5~") {
      this.actions.onScrollUp(10);
      return;
    }
    if (key === "\x1B[6~") {
      this.actions.onScrollDown(10);
      return;
    }
    if (key === "\x1B[H" || key === "\x1B[1~") {
      this.actions.onScrollTop();
      return;
    }
    if (key === "\x1B[F" || key === "\x1B[4~") {
      this.actions.onScrollBottom();
      return;
    }
    if (key === "f" || key === "F" || key === "s" || key === "S") {
      this.actions.onToggleAutoScroll();
      return;
    }
    if (key === "c" || key === "C") {
      this.actions.onClearLogs();
      return;
    }
    if (key === "h" || key === "H" || key === "?") {
      this.actions.onToggleHelp();
      return;
    }
  }
};

// src/engine/sync-runner.ts
import { EventEmitter } from "events";
import { spawn } from "child_process";

// src/engine/progress-parser.ts
var ProgressParser = class {
  metrics = {
    percentage: 0,
    transferredBytes: 0,
    totalBytes: 0,
    speed: "0 B/s",
    speedBytesPerSec: 0,
    eta: "--:--:--",
    currentFile: "",
    filesTransferred: 0,
    totalFiles: 0,
    checksDone: 0,
    totalChecks: 0,
    errorsCount: 0,
    elapsedSeconds: 0
  };
  getMetrics() {
    return { ...this.metrics };
  }
  parseLine(line) {
    let trimmed = line.trim();
    if (!trimmed) return { isProgress: false };
    trimmed = trimmed.replace(/^<\d+>(INFO|NOTICE|DEBUG|WARN|ERROR)\s*:\s*/i, "").replace(/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+(INFO|NOTICE|DEBUG|WARN|ERROR)\s*:\s*/i, "").trim();
    let updated = false;
    const rsyncMatch = trimmed.match(
      /^\s*([\d,]+)\s+(\d+)%\s+([\d.]+\w+\/s)\s+(\d+:\d+:\d+)(?:\s+\(xfr#(\d+),\s+to-chk=(\d+)\/(\d+)\))?/i
    );
    if (rsyncMatch) {
      this.metrics.transferredBytes = parseInt(rsyncMatch[1].replace(/,/g, ""), 10);
      this.metrics.percentage = parseInt(rsyncMatch[2], 10);
      this.metrics.speed = rsyncMatch[3];
      this.metrics.eta = rsyncMatch[4];
      if (rsyncMatch[5]) {
        this.metrics.filesTransferred = parseInt(rsyncMatch[5], 10);
      }
      if (rsyncMatch[6] && rsyncMatch[7]) {
        const remaining = parseInt(rsyncMatch[6], 10);
        const total = parseInt(rsyncMatch[7], 10);
        this.metrics.totalFiles = total;
      }
      if (this.metrics.percentage > 0 && this.metrics.transferredBytes > 0) {
        this.metrics.totalBytes = Math.round(this.metrics.transferredBytes / this.metrics.percentage * 100);
      }
      return { isProgress: true, metrics: this.getMetrics() };
    }
    const rcloneBytesMatch = trimmed.match(
      /Transferred:\s+([\d.,]+\s*\w+)\s*\/\s*([\d.,]+\s*\w+),\s*(\d+)%,\s*([\d.,]+\s*\w+\/s)(?:,\s*ETA\s*([\w\d]+))?/i
    );
    if (rcloneBytesMatch) {
      this.metrics.transferredBytes = parseBytes(rcloneBytesMatch[1]);
      this.metrics.totalBytes = parseBytes(rcloneBytesMatch[2]);
      this.metrics.percentage = parseInt(rcloneBytesMatch[3], 10);
      this.metrics.speed = rcloneBytesMatch[4];
      this.metrics.eta = rcloneBytesMatch[5] || "--:--:--";
      updated = true;
    }
    const rcloneChecksInline = trimmed.match(/\(chk#(\d+)\/(\d+)\)/i);
    if (rcloneChecksInline) {
      this.metrics.checksDone = parseInt(rcloneChecksInline[1], 10);
      this.metrics.totalChecks = parseInt(rcloneChecksInline[2], 10);
      updated = true;
    }
    const rcloneChecksMatch = trimmed.match(/Checks:\s+(\d+)\s*\/\s*(\d+)/i);
    if (rcloneChecksMatch) {
      this.metrics.checksDone = parseInt(rcloneChecksMatch[1], 10);
      this.metrics.totalChecks = parseInt(rcloneChecksMatch[2], 10);
      updated = true;
    }
    const rcloneXfrInline = trimmed.match(/\(xfr#(\d+)\/(\d+)\)/i);
    if (rcloneXfrInline) {
      this.metrics.filesTransferred = parseInt(rcloneXfrInline[1], 10);
      this.metrics.totalFiles = parseInt(rcloneXfrInline[2], 10);
      updated = true;
    }
    const rcloneFilesMatch = trimmed.match(/Transferred:\s+(\d+)\s*\/\s*(\d+),\s*(\d+)%/i);
    if (rcloneFilesMatch) {
      this.metrics.filesTransferred = parseInt(rcloneFilesMatch[1], 10);
      this.metrics.totalFiles = parseInt(rcloneFilesMatch[2], 10);
      updated = true;
    }
    const rcloneOneLine = trimmed.match(
      /^([\d.,]+\s*[KMGT]?i?B?)\s*\/\s*([\d.,]+\s*[KMGT]?i?B?),\s*([0-9%]+|-),\s*([\d.,]+\s*[KMGT]?i?B?\/s),\s*(?:ETA\s*)?([^\s()]+)/i
    );
    if (rcloneOneLine) {
      this.metrics.transferredBytes = parseBytes(rcloneOneLine[1]);
      this.metrics.totalBytes = parseBytes(rcloneOneLine[2]);
      const p = parseInt(rcloneOneLine[3].replace("%", ""), 10);
      if (!isNaN(p)) {
        this.metrics.percentage = p;
      }
      this.metrics.speed = rcloneOneLine[4];
      this.metrics.eta = rcloneOneLine[5] !== "-" ? rcloneOneLine[5] : "--:--:--";
      updated = true;
    }
    const rcloneFileProgress = trimmed.match(/^\*\s+(.+?):\s*(\d+)%\s*\/?([^,]*),\s*([\d.,]+\s*\w+\/s)?/i);
    if (rcloneFileProgress) {
      this.metrics.currentFile = rcloneFileProgress[1];
      updated = true;
    }
    const errorMatch = trimmed.match(/Errors:\s+(\d+)/i);
    if (errorMatch) {
      this.metrics.errorsCount = parseInt(errorMatch[1], 10);
      updated = true;
    }
    return { isProgress: updated, metrics: updated ? this.getMetrics() : void 0 };
  }
};

// src/engine/sync-runner.ts
var SyncRunner = class extends EventEmitter {
  childProcess = null;
  parser;
  status = "IDLE";
  config;
  logIdCounter = 0;
  isPaused = false;
  constructor(config) {
    super();
    this.config = config;
    this.parser = new ProgressParser();
  }
  getStatus() {
    return this.status;
  }
  getPid() {
    return this.childProcess?.pid;
  }
  start() {
    if (this.childProcess) return;
    this.setStatus("SCANNING");
    this.addLog("INFO", `Starting sync: ${this.config.source} -> ${this.config.remote}`);
    const args = [
      "sync",
      this.config.source,
      this.config.remote,
      "--track-renames",
      "--metadata",
      `--transfers=${this.config.transfers || 2}`,
      `--checkers=${this.config.checkers || 4}`,
      `--bwlimit=${this.config.bwlimit || "15M"}`,
      "--stats=1s",
      "--stats-one-line",
      "--log-level=INFO",
      // Always exclude cinema to prevent massive unwanted media uploads
      "--exclude=cinema/**",
      "--exclude=cinema/",
      "--exclude=/cinema/**",
      "--exclude=.DS_Store",
      "--exclude=node_modules/**",
      "--exclude=.git/**"
    ];
    if (this.config.excludeFile) {
      args.push(`--exclude-from=${this.config.excludeFile}`);
    }
    try {
      this.childProcess = spawn("rclone", args, {
        stdio: ["pipe", "pipe", "pipe"]
      });
      this.setStatus("RUNNING");
      this.handleStream(this.childProcess.stdout, false);
      this.handleStream(this.childProcess.stderr, true);
      this.childProcess.on("error", (err) => {
        this.setStatus("ERROR");
        this.addLog("ERROR", `Process error: ${err.message}`);
        this.emit("error", err);
      });
      this.childProcess.on("close", (code) => {
        this.childProcess = null;
        if (code === 0) {
          this.setStatus("COMPLETED");
          this.addLog("SUCCESS", "Synchronization completed successfully! (100%)");
        } else {
          this.setStatus("ERROR");
          this.addLog("ERROR", `Process exited with code ${code}`);
        }
        this.emit("exit", code);
      });
    } catch (err) {
      this.setStatus("ERROR");
      const message = err instanceof Error ? err.message : String(err);
      this.addLog("ERROR", `Failed to spawn rclone: ${message}`);
    }
  }
  pause() {
    if (!this.childProcess || !this.childProcess.pid || this.isPaused) return false;
    try {
      process.kill(this.childProcess.pid, "SIGSTOP");
      this.isPaused = true;
      this.setStatus("PAUSED");
      this.addLog("WARN", "\u23F8 Synchronization PAUSED by user (SIGSTOP)");
      return true;
    } catch (err) {
      this.addLog("ERROR", `Failed to pause process: ${err}`);
      return false;
    }
  }
  resume() {
    if (!this.childProcess || !this.childProcess.pid || !this.isPaused) return false;
    try {
      process.kill(this.childProcess.pid, "SIGCONT");
      this.isPaused = false;
      this.setStatus("RUNNING");
      this.addLog("INFO", "\u25B6 Synchronization RESUMED by user (SIGCONT)");
      return true;
    } catch (err) {
      this.addLog("ERROR", `Failed to resume process: ${err}`);
      return false;
    }
  }
  togglePause() {
    if (this.isPaused) {
      return this.resume();
    } else {
      return this.pause();
    }
  }
  stop() {
    if (!this.childProcess) return;
    try {
      if (this.childProcess.pid) {
        if (this.isPaused) {
          process.kill(this.childProcess.pid, "SIGCONT");
        }
        this.childProcess.kill("SIGTERM");
      }
    } catch {
    }
  }
  handleStream(stream, isStderr) {
    if (!stream) return;
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const parts = buffer.split(/[\r\n]+/);
      buffer = parts.pop() || "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const { isProgress, metrics } = this.parser.parseLine(trimmed);
        if (isProgress && metrics) {
          this.emit("metrics", metrics);
        } else {
          const level = this.detectLogLevel(trimmed, isStderr);
          this.addLog(level, trimmed);
        }
      }
    });
  }
  detectLogLevel(line, isStderr) {
    const upper = line.toUpperCase();
    if (upper.includes("ERROR") || upper.includes("FAILED") || isStderr) return "ERROR";
    if (upper.includes("WARN") || upper.includes("WAIT")) return "WARN";
    if (upper.includes("DONE") || upper.includes("COMPLETED") || upper.includes("SUCCESS") || upper.includes("\u041F\u041E\u0413\u041D\u0410\u041B\u0418"))
      return "SUCCESS";
    return "INFO";
  }
  setStatus(status) {
    this.status = status;
    this.emit("status", status);
  }
  addLog(level, message) {
    const entry = {
      id: ++this.logIdCounter,
      timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
      level,
      message,
      raw: message
    };
    this.emit("log", entry);
  }
};

// src/engine/service-watcher.ts
import { EventEmitter as EventEmitter2 } from "events";
import { spawn as spawn2, execSync } from "child_process";
var ServiceWatcher = class extends EventEmitter2 {
  childProcess = null;
  parser;
  status = "RUNNING";
  logIdCounter = 0;
  serviceName;
  isPaused = false;
  constructor(serviceName = "gdrive-sync.service") {
    super();
    this.serviceName = serviceName;
    this.parser = new ProgressParser();
  }
  getStatus() {
    return this.status;
  }
  isServiceActive() {
    try {
      const out = execSync(`systemctl is-active ${this.serviceName} 2>/dev/null`, { encoding: "utf8" }).trim();
      return out === "active";
    } catch {
      return false;
    }
  }
  getActiveRclonePid() {
    try {
      const pids = execSync(`pgrep -f "rclone sync" 2>/dev/null`, { encoding: "utf8" }).trim().split("\n");
      const pid = parseInt(pids[0], 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }
  start() {
    this.setStatus("RUNNING");
    this.addLog("INFO", `Attached to live daemon service: ${this.serviceName}`);
    try {
      this.childProcess = spawn2(
        "journalctl",
        ["-u", this.serviceName, "-f", "-n", "100", "--output=cat", "--no-tail"],
        {
          stdio: ["pipe", "pipe", "pipe"]
        }
      );
      this.childProcess.stdout?.on("data", (chunk) => {
        const text = chunk.toString();
        const lines = text.split(/[\r\n]+/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const { isProgress, metrics } = this.parser.parseLine(trimmed);
          if (isProgress && metrics) {
            this.emit("metrics", metrics);
          } else {
            const level = this.detectLogLevel(trimmed);
            this.addLog(level, trimmed);
          }
        }
      });
      this.childProcess.stderr?.on("data", (chunk) => {
        this.addLog("WARN", chunk.toString().trim());
      });
      this.childProcess.on("close", (code) => {
        this.addLog("INFO", `Journal stream disconnected (code ${code})`);
      });
    } catch (err) {
      this.setStatus("ERROR");
      const message = err instanceof Error ? err.message : String(err);
      this.addLog("ERROR", `Failed to attach to journalctl: ${message}`);
    }
  }
  pause() {
    const pid = this.getActiveRclonePid();
    if (!pid) {
      this.addLog("WARN", "No active rclone transfer process found to pause.");
      return false;
    }
    try {
      process.kill(pid, "SIGSTOP");
      this.isPaused = true;
      this.setStatus("PAUSED");
      this.addLog("WARN", `\u23F8 Rclone process (PID: ${pid}) PAUSED by user (SIGSTOP)`);
      return true;
    } catch (err) {
      this.addLog("ERROR", `Failed to pause rclone PID ${pid}: ${err}`);
      return false;
    }
  }
  resume() {
    const pid = this.getActiveRclonePid();
    if (!pid) {
      this.addLog("WARN", "No active rclone process found to resume.");
      return false;
    }
    try {
      process.kill(pid, "SIGCONT");
      this.isPaused = false;
      this.setStatus("RUNNING");
      this.addLog("INFO", `\u25B6 Rclone process (PID: ${pid}) RESUMED by user (SIGCONT)`);
      return true;
    } catch (err) {
      this.addLog("ERROR", `Failed to resume rclone PID ${pid}: ${err}`);
      return false;
    }
  }
  togglePause() {
    if (this.isPaused) {
      return this.resume();
    } else {
      return this.pause();
    }
  }
  stop() {
    if (this.childProcess) {
      this.childProcess.kill("SIGTERM");
      this.childProcess = null;
    }
  }
  detectLogLevel(line) {
    const upper = line.toUpperCase();
    if (upper.includes("ERROR") || upper.includes("FAILED")) return "ERROR";
    if (upper.includes("WARN") || upper.includes("WAIT")) return "WARN";
    if (upper.includes("DONE") || upper.includes("COMPLETED") || upper.includes("SUCCESS") || upper.includes("\u041F\u041E\u0413\u041D\u0410\u041B\u0418"))
      return "SUCCESS";
    return "INFO";
  }
  setStatus(status) {
    this.status = status;
    this.emit("status", status);
  }
  addLog(level, message) {
    const entry = {
      id: ++this.logIdCounter,
      timestamp: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
      level,
      message,
      raw: message
    };
    this.emit("log", entry);
  }
};

// src/index.ts
import { spawn as spawn3, execSync as execSync2 } from "child_process";
var program = new Command();
program.name("gsync").description("\u26A1 High-performance interactive TUI for Google Drive and rsync/rclone synchronization").version("1.0.0").option("-s, --source <path>", "Source directory to sync", "/mnt/backup").option("-r, --remote <remote>", "Target remote path", "gdrive:Sync/Backup").option("-e, --exclude-file <path>", "Path to rclone exclude file", "/home/resonaura/rclone-exclude.txt").option("-b, --bwlimit <limit>", "Bandwidth limit", "15M").option("-t, --transfers <number>", "Number of parallel transfers", "2").option("-c, --checkers <number>", "Number of checkers", "4").option("--direct", "Force direct sync process instead of attaching to service", false).action((options) => {
  runApp({
    source: options.source,
    remote: options.remote,
    excludeFile: options.excludeFile,
    bwlimit: options.bwlimit,
    transfers: parseInt(options.transfers, 10),
    checkers: parseInt(options.checkers, 10),
    mode: options.direct ? "direct" : "daemon"
  });
});
program.command("daemon").description("Run headless background watcher daemon for automated sync").option("-s, --source <path>", "Source directory to sync", "/mnt/backup").option("-r, --remote <remote>", "Target remote path", "gdrive:Sync/Backup").option("-e, --exclude-file <path>", "Path to rclone exclude file", "/home/resonaura/rclone-exclude.txt").action((options) => {
  runDaemon({
    source: options.source,
    remote: options.remote,
    excludeFile: options.excludeFile,
    mode: "direct"
  });
});
program.command("service <action>").description("Manage systemd background service (status, restart, stop, logs)").action((action) => {
  switch (action) {
    case "status":
      try {
        execSync2("systemctl status gsync.service --no-pager", { stdio: "inherit" });
      } catch {
      }
      break;
    case "restart":
      try {
        execSync2("systemctl restart gsync.service", { stdio: "inherit" });
        console.log("\u2705 gsync.service restarted.");
      } catch (e) {
        console.error("Failed to restart service:", e);
      }
      break;
    case "stop":
      try {
        execSync2("systemctl stop gsync.service", { stdio: "inherit" });
        console.log("\u{1F6D1} gsync.service stopped.");
      } catch (e) {
        console.error("Failed to stop service:", e);
      }
      break;
    case "logs":
      try {
        execSync2("journalctl -u gsync.service -n 50 --no-pager", { stdio: "inherit" });
      } catch {
      }
      break;
    default:
      console.log("Unknown action. Available: status, restart, stop, logs");
  }
});
program.parse(process.argv);
function runApp(config) {
  const terminal = new Terminal();
  const renderer = new TUIRenderer();
  const state = {
    status: "SCANNING",
    metrics: {
      percentage: 0,
      transferredBytes: 0,
      totalBytes: 0,
      speed: "0 B/s",
      speedBytesPerSec: 0,
      eta: "--:--:--",
      currentFile: "",
      filesTransferred: 0,
      totalFiles: 0,
      checksDone: 0,
      totalChecks: 0,
      errorsCount: 0,
      elapsedSeconds: 0
    },
    logs: [],
    scrollOffset: 0,
    autoScroll: true,
    activeView: "main",
    startTime: Date.now(),
    totalPausedDuration: 0
  };
  let engine;
  const watcher = new ServiceWatcher("gsync.service");
  const oldWatcher = new ServiceWatcher("gdrive-sync.service");
  if (config.mode === "daemon" && (watcher.isServiceActive() || oldWatcher.isServiceActive())) {
    config.mode = "daemon";
    engine = watcher.isServiceActive() ? watcher : oldWatcher;
  } else {
    config.mode = "direct";
    engine = new SyncRunner(config);
  }
  terminal.init();
  engine.on("status", (newStatus) => {
    state.status = newStatus;
  });
  engine.on("metrics", (newMetrics) => {
    state.metrics = { ...state.metrics, ...newMetrics };
  });
  engine.on("log", (entry) => {
    state.logs.push(entry);
    if (state.logs.length > 2e3) {
      state.logs.shift();
    }
  });
  const inputHandler = new InputHandler({
    onTogglePause: () => {
      engine.togglePause();
    },
    onScrollUp: (amount) => {
      state.autoScroll = false;
      state.scrollOffset = Math.min(state.logs.length, state.scrollOffset + amount);
    },
    onScrollDown: (amount) => {
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
      state.activeView = state.activeView === "help" ? "main" : "help";
    },
    onCloseHelp: () => {
      if (state.activeView === "help") {
        state.activeView = "main";
      }
    },
    onQuit: () => {
      cleanupAndExit(0);
    }
  });
  if (process.stdin.isTTY) {
    process.stdin.on("data", (data) => {
      inputHandler.handleInput(data.toString());
    });
  }
  engine.start();
  const renderInterval = setInterval(() => {
    const { width, height } = terminal.getSize();
    renderer.render(state, config, width, height);
  }, 100);
  function cleanupAndExit(code) {
    clearInterval(renderInterval);
    engine.stop();
    terminal.restore();
    process.exit(code);
  }
}
function runDaemon(config) {
  console.log(`[Daemon] \u{1F680} GSYNC daemon started for ${config.source} -> ${config.remote}`);
  let isSyncing = false;
  let pendingSync = false;
  const triggerSync = () => {
    if (isSyncing) {
      pendingSync = true;
      return;
    }
    isSyncing = true;
    console.log(`[Daemon] \u{1F4E4} [${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Starting synchronization cycle...`);
    const runner = new SyncRunner(config);
    runner.on("log", (log) => {
      console.log(`[${log.timestamp}] [${log.level}] ${log.message}`);
    });
    runner.on("metrics", (metrics) => {
      if (metrics.percentage > 0) {
        console.log(`[Progress] ${metrics.percentage}% | ${metrics.speed} | ETA: ${metrics.eta} | Files: ${metrics.filesTransferred}/${metrics.totalFiles}`);
      }
    });
    runner.on("exit", () => {
      isSyncing = false;
      console.log(`[Daemon] \u{1F634} Synchronization cycle finished. Watching for new changes...`);
      if (pendingSync) {
        pendingSync = false;
        setTimeout(triggerSync, 5e3);
      }
    });
    runner.start();
  };
  triggerSync();
  try {
    const inotify = spawn3("inotifywait", [
      "-m",
      "-r",
      "-e",
      "close_write,move,create,delete",
      "--exclude",
      "(cinema|\\.tmp|\\._*|node_modules|\\.git)",
      config.source
    ]);
    let debounceTimer = null;
    inotify.stdout.on("data", (data) => {
      const line = data.toString().trim();
      if (!line) return;
      console.log(`[Daemon] \u{1F440} Change detected: ${line.split(" ").slice(2).join(" ")}`);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`[Daemon] \u23F1 Debounce finished, triggering sync...`);
        triggerSync();
      }, 15e3);
    });
    inotify.on("error", () => {
      console.warn("[Daemon] inotifywait not found, running scheduled sync every 10 minutes.");
      setInterval(triggerSync, 10 * 60 * 1e3);
    });
  } catch {
    console.warn("[Daemon] Fallback: running scheduled sync every 10 minutes.");
    setInterval(triggerSync, 10 * 60 * 1e3);
  }
}
//# sourceMappingURL=index.js.map