export const A = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  amber: "\x1B[33m",
  green: "\x1B[32m",
  red: "\x1B[31m",
  muted: "\x1B[90m",
  white: "\x1B[97m",
  up: (n: number) => `\x1B[${n}A`,
  clearLine: "\x1B[2K\r",
  hideCursor: "\x1B[?25l",
  showCursor: "\x1B[?25h",
} as const;

export function amber(s: string) { return `${A.amber}${s}${A.reset}`; }
export function green(s: string) { return `${A.green}${s}${A.reset}`; }
export function red(s: string)   { return `${A.red}${s}${A.reset}`; }
export function dim(s: string)   { return `${A.dim}${s}${A.reset}`; }
export function bold(s: string)  { return `${A.bold}${s}${A.reset}`; }
export function muted(s: string) { return `${A.muted}${s}${A.reset}`; }
