export interface InputActions {
  onTogglePause: () => void;
  onScrollUp: (amount: number) => void;
  onScrollDown: (amount: number) => void;
  onScrollTop: () => void;
  onScrollBottom: () => void;
  onToggleAutoScroll: () => void;
  onClearLogs: () => void;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
  onQuit: () => void;
}

export class InputHandler {
  private actions: InputActions;

  constructor(actions: InputActions) {
    this.actions = actions;
  }

  public handleInput(key: string): void {
    // 1. Mouse SGR Scroll Up: \x1b[<64;...;...M / \x1b[<64;...;...m
    if (/\x1b\[<64;\d+;\d+[Mm]/.test(key)) {
      this.actions.onScrollUp(3);
      return;
    }

    // 2. Mouse SGR Scroll Down: \x1b[<65;...;...M / \x1b[<65;...;...m
    if (/\x1b\[<65;\d+;\d+[Mm]/.test(key)) {
      this.actions.onScrollDown(3);
      return;
    }

    // 3. Normal X10 Mouse Wheel
    if (key.startsWith('\x1b[M')) {
      const b = key.charCodeAt(3) - 32;
      if (b === 64) {
        this.actions.onScrollUp(3);
        return;
      } else if (b === 65) {
        this.actions.onScrollDown(3);
        return;
      }
    }

    // Ctrl+C or 'q' or 'Q'
    if (key === '\u0003' || key === 'q' || key === 'Q') {
      this.actions.onQuit();
      return;
    }

    // Escape
    if (key === '\u001b') {
      this.actions.onCloseHelp();
      return;
    }

    // Space or 'p' or 'P'
    if (key === ' ' || key === 'p' || key === 'P') {
      this.actions.onTogglePause();
      return;
    }

    // Up arrow
    if (key === '\u001b[A' || key === 'k') {
      this.actions.onScrollUp(1);
      return;
    }

    // Down arrow
    if (key === '\u001b[B' || key === 'j') {
      this.actions.onScrollDown(1);
      return;
    }

    // PageUp
    if (key === '\u001b[5~') {
      this.actions.onScrollUp(10);
      return;
    }

    // PageDown
    if (key === '\u001b[6~') {
      this.actions.onScrollDown(10);
      return;
    }

    // Home
    if (key === '\u001b[H' || key === '\u001b[1~') {
      this.actions.onScrollTop();
      return;
    }

    // End
    if (key === '\u001b[F' || key === '\u001b[4~') {
      this.actions.onScrollBottom();
      return;
    }

    // 'f' / 'F' / 's' / 'S' (Toggle auto-scroll)
    if (key === 'f' || key === 'F' || key === 's' || key === 'S') {
      this.actions.onToggleAutoScroll();
      return;
    }

    // 'c' / 'C' (Clear logs)
    if (key === 'c' || key === 'C') {
      this.actions.onClearLogs();
      return;
    }

    // 'h' / 'H' / '?' (Help)
    if (key === 'h' || key === 'H' || key === '?') {
      this.actions.onToggleHelp();
      return;
    }
  }
}
