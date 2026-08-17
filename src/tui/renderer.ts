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
    if (width < 30 || height < 12) {
      this.renderSmallScreenWarning(width, height);
      return;
    }

    if (state.activeView === 'help') {
      const helpLines = renderHelpModal(width, height);
      this.writeBuffer(helpLines, height);
      return;
    }

    const headerLines = renderHeader(state, config, width); // 3 lines
    const progressBarLines = renderProgressBar(state, width); // 3 lines
    const footerLines = renderKeybindingsBar(state, width); // 1 line

    // Calculate viewport height
    const reservedHeight = headerLines.length + progressBarLines.length + footerLines.length;
    const viewportHeight = Math.max(3, height - reservedHeight);

    const logLines = renderLogViewport(state, width, viewportHeight);

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
    const output = ESC.cursorHome + cropped.join('\n');

    if (output !== this.lastRenderOutput) {
      process.stdout.write(output);
      this.lastRenderOutput = output;
    }
  }

  private renderSmallScreenWarning(width: number, height: number): void {
    const msg = `Terminal too small: ${width}x${height} (Min: 30x12)`;
    process.stdout.write(ESC.cursorHome + msg);
  }
}
