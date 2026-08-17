export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  if (i >= sizes.length) return `${(bytes / Math.pow(k, sizes.length - 1)).toFixed(dm)} ${sizes[sizes.length - 1]}`;
  return `${(bytes / Math.pow(k, i)).toFixed(dm)} ${sizes[i]}`;
}

export function parseBytes(str: string): number {
  if (!str) return 0;
  const match = str.trim().match(/^([\d.,]+)\s*([a-zA-Z]*)$/);
  if (!match) return 0;
  const val = parseFloat(match[1].replace(/,/g, ''));
  const unit = (match[2] || '').toUpperCase();
  switch (unit) {
    case 'K':
    case 'KB':
    case 'KIB':
      return val * 1024;
    case 'M':
    case 'MB':
    case 'MIB':
      return val * 1024 * 1024;
    case 'G':
    case 'GB':
    case 'GIB':
      return val * 1024 * 1024 * 1024;
    case 'T':
    case 'TB':
    case 'TIB':
      return val * 1024 * 1024 * 1024 * 1024;
    case 'B':
    default:
      return val;
  }
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '--:--:--';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function truncateMiddle(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str || '';
  if (maxLength <= 5) return str.slice(0, maxLength);
  const half = Math.floor((maxLength - 3) / 2);
  return `${str.slice(0, half)}...${str.slice(str.length - (maxLength - 3 - half))}`;
}

export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

export function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

export function padVisible(str: string, targetLen: number, char: string = ' '): string {
  const vis = visibleLength(str);
  if (vis >= targetLen) return str;
  return str + char.repeat(targetLen - vis);
}
