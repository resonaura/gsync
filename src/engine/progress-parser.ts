import { ProgressMetrics } from '../types.js';
import { parseBytes } from '../utils/formatters.js';

export class ProgressParser {
  private metrics: ProgressMetrics = {
    percentage: 0,
    transferredBytes: 0,
    totalBytes: 0,
    speed: '0 B/s',
    speedBytesPerSec: 0,
    eta: '--:--:--',
    currentFile: '',
    filesTransferred: 0,
    totalFiles: 0,
    checksDone: 0,
    totalChecks: 0,
    errorsCount: 0,
    elapsedSeconds: 0,
  };

  public getMetrics(): ProgressMetrics {
    return { ...this.metrics };
  }

  public parseLine(line: string): { isProgress: boolean; metrics?: ProgressMetrics } {
    let trimmed = line.trim();
    if (!trimmed) return { isProgress: false };

    // Strip systemd / journalctl and rclone prefix if present
    trimmed = trimmed
      .replace(/^<\d+>(INFO|NOTICE|DEBUG|WARN|ERROR)\s*:\s*/i, '')
      .replace(/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s+(INFO|NOTICE|DEBUG|WARN|ERROR)\s*:\s*/i, '')
      .trim();

    let updated = false;

    // 1. Rsync --info=progress2 format:
    // "1,024,202,031  67%  163.00MB/s    0:00:05  (xfr#12, to-chk=2/300)"
    const rsyncMatch = trimmed.match(
      /^\s*([\d,]+)\s+(\d+)%\s+([\d.]+\w+\/s)\s+(\d+:\d+:\d+)(?:\s+\(xfr#(\d+),\s+to-chk=(\d+)\/(\d+)\))?/i,
    );
    if (rsyncMatch) {
      this.metrics.transferredBytes = parseInt(rsyncMatch[1].replace(/,/g, ''), 10);
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
        this.metrics.totalBytes = Math.round((this.metrics.transferredBytes / this.metrics.percentage) * 100);
      }
      return { isProgress: true, metrics: this.getMetrics() };
    }

    // 2. Rclone standard stats:
    // "Transferred:   1.234 GiB / 10.456 GiB, 12%, 14.50 MiB/s, ETA 10m20s"
    const rcloneBytesMatch = trimmed.match(
      /Transferred:\s+([\d.,]+\s*\w+)\s*\/\s*([\d.,]+\s*\w+),\s*(\d+)%,\s*([\d.,]+\s*\w+\/s)(?:,\s*ETA\s*([\w\d]+))?/i,
    );
    if (rcloneBytesMatch) {
      this.metrics.transferredBytes = parseBytes(rcloneBytesMatch[1]);
      this.metrics.totalBytes = parseBytes(rcloneBytesMatch[2]);
      this.metrics.percentage = parseInt(rcloneBytesMatch[3], 10);
      this.metrics.speed = rcloneBytesMatch[4];
      this.metrics.eta = rcloneBytesMatch[5] || '--:--:--';
      updated = true;
    }

    // 3. Rclone checks stats:
    // "Checks: 105 / 346, 30%" or "(chk#105/346)"
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

    // 4. Rclone files count:
    // "Transferred:        12 / 50, 24%" or "(xfr#12/50)"
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

    // 5. Rclone single-line stats:
    // "1.234G / 10.456G, 12%, 14.50M/s, 10m20s"
    // "0 B / 0 B, -, 0 B/s, ETA -"
    const rcloneOneLine = trimmed.match(
      /^([\d.,]+\s*[KMGT]?i?B?)\s*\/\s*([\d.,]+\s*[KMGT]?i?B?),\s*([0-9%]+|-),\s*([\d.,]+\s*[KMGT]?i?B?\/s),\s*(?:ETA\s*)?([^\s()]+)/i,
    );
    if (rcloneOneLine) {
      this.metrics.transferredBytes = parseBytes(rcloneOneLine[1]);
      this.metrics.totalBytes = parseBytes(rcloneOneLine[2]);
      const p = parseInt(rcloneOneLine[3].replace('%', ''), 10);
      if (!isNaN(p)) {
        this.metrics.percentage = p;
      }
      this.metrics.speed = rcloneOneLine[4];
      this.metrics.eta = rcloneOneLine[5] !== '-' ? rcloneOneLine[5] : '--:--:--';
      updated = true;
    }

    // 6. Rclone current active file:
    // "* subfolder/document.pdf: 45% /100MiB, 5.2MiB/s, 10s"
    const rcloneFileProgress = trimmed.match(/^\*\s+(.+?):\s*(\d+)%\s*\/?([^,]*),\s*([\d.,]+\s*\w+\/s)?/i);
    if (rcloneFileProgress) {
      this.metrics.currentFile = rcloneFileProgress[1];
      updated = true;
    }

    // 7. Errors count:
    const errorMatch = trimmed.match(/Errors:\s+(\d+)/i);
    if (errorMatch) {
      this.metrics.errorsCount = parseInt(errorMatch[1], 10);
      updated = true;
    }

    return { isProgress: updated, metrics: updated ? this.getMetrics() : undefined };
  }
}
