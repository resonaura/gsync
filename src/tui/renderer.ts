import { ESC } from '../utils/ansi.js';
import { SyncConfig, TUIState } from '../types.js';
import { renderHeader } from './components/header.js';
import { renderLogViewport } from './components/log-viewport.js';
import { renderProgressBar } from './components/progress-bar.js';
import { renderKeybindingsBar } from './components/keybindings-bar.js';
import { renderHelpModal } from './components/help-modal.js';

export class TUIRenderer {
  private lastRenderOutput = '';

  public render(state: TUIState, config: SyncConfig, width: number, height: number): void {
    if (width < 30 || height < 10) {
      this.renderSmallScreenWarning(width, height);
      return;
    }

    if (state.activeView === 'help') {
      const helpLines = renderHelpModal(width, height);
      this.writeBuffer(helpLines, height);
      return;
    }

    const headerLines = renderHeader(state, config, width); // 2 lines
    const progressBarLines = renderProgressBar(state, width); // 3 lines
    const footerLines = renderKeybindingsBar(state, width); // 1 line

    // 2 (header) + 2 (log top/bottom borders) + 3 (progress) + 1 (footer) = 8
    const fixedRows = headerLines.length + 2 + progressBarLines.length + footerLines.length;
    const effectiveLogRows = Math.max(1, height - fixedRows);

    const logLines = renderLogViewport(state, width, effectiveLogRows);

    const fullScreenLines = [
      ...headerLines,
      ...logLines,
      ...progressBarLines,
      ...footerLines,
    ];

    this.writeBuffer(fullScreenLines, height);
  }

  private writeBuffer(lines: string[], maxRows: number): void {
    const cropped = lines.slice(0, maxRows);
    // Use cursorHome and join with \n (no trailing newline to avoid scrolling)
    const output = ESC.cursorHome + cropped.join('\n');

    if (output !== this.lastRenderOutput) {
      process.stdout.write(output);
      this.lastRenderOutput = output;
    }
  }

  private renderSmallScreenWarning(width: number, height: number): void {
    const msg = `Terminal too small: ${width}x${height} (Min: 30x10)`;
    process.stdout.write(ESC.cursorHome + msg);
  }
}
