# ⚡ GSYNC

High-performance interactive Terminal UI (TUI) for real-time Google Drive, rsync, and rclone file synchronization with POSIX pause/resume controls and nano-style keybindings.

## ✨ Features

- 🖥️ **Btop & Nano inspired Layout**:
  - Top header with status badges (`RUNNING`, `PAUSED`, `COMPLETED`, `ERROR`), source $\to$ destination, and live timer.
  - Middle scrollable live log ring buffer with level tags (`INF`, `WRN`, `ERR`, `OK`).
  - High-resolution fractional Unicode progress bar (`█▉▊▋▌▍▎▏`) with percentage, transferred/total bytes, speed, ETA, and checks count.
  - Fixed bottom keybindings bar with interactive shortcut hints.
- ⏸️ **POSIX Process Control**: Instant pause/resume of the active sync process via `SIGSTOP` / `SIGCONT` without killing the connection.
- 🚫 **Automatic Safety Excludes**: Built-in exclusion of heavy media directories (e.g. `/backup/cinema`, `cinema/**`, `node_modules`).
- ⚡ **Zero-Flicker Double-Buffered Rendering**: ANSI diffing engine with TrueColor support.
- 📡 **Daemon & Direct Sync Modes**: Automatically attaches to the background `gdrive-sync.service` or runs standalone sync.

## ⌨️ Keybindings

| Key | Action |
| --- | --- |
| `Space` or `P` | Pause / Resume synchronization (`SIGSTOP`/`SIGCONT`) |
| `↑` / `↓` | Scroll log history up / down line-by-line |
| `PageUp` / `PageDown` | Scroll log history by 10 lines |
| `Home` / `End` | Jump to top / bottom of log buffer |
| `F` or `S` | Toggle Follow / Autoscroll mode |
| `C` | Clear log viewport |
| `H` or `?` | Show Help modal overlay |
| `Q` or `Ctrl+C` | Safely exit and restore terminal |

## 🚀 Installation & Usage

```bash
pnpm install
pnpm build
npm link # or pnpm link --global
```

Run interactive sync:
```bash
gsync
```

Run with custom paths:
```bash
gsync -s /mnt/backup -r gdrive:Sync/Backup --bwlimit 20M
```

## 📄 License
MIT © [Andrii Vynohradov](https://github.com/resonaura)
