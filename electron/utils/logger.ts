import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, mkdirSync } from 'fs'

// ─────────────────────────────────────────────────────────────────────────────
// logger.ts — Minimal file + console logger for the main process.
// ─────────────────────────────────────────────────────────────────────────────

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

function getLogPath(): string {
  try {
    const logsDir = join(app.getPath('logs'))
    mkdirSync(logsDir, { recursive: true })
    return join(logsDir, 'coders-note.log')
  } catch {
    return join(process.cwd(), 'coders-note.log')
  }
}

function write(level: LogLevel, message: string, ...args: unknown[]): void {
  const ts = new Date().toISOString()
  const extra = args.length ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : ''
  const line = `[${ts}] [${level}] ${message}${extra}\n`

  // Console output
  if (level === 'ERROR') process.stderr.write(line)
  else process.stdout.write(line)

  // File output (best-effort, don't crash if it fails)
  try {
    appendFileSync(getLogPath(), line, 'utf-8')
  } catch { /* ignore */ }
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => write('DEBUG', msg, ...args),
  info:  (msg: string, ...args: unknown[]) => write('INFO',  msg, ...args),
  warn:  (msg: string, ...args: unknown[]) => write('WARN',  msg, ...args),
  error: (msg: string, ...args: unknown[]) => write('ERROR', msg, ...args),
}
