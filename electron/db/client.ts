import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { readdirSync, readFileSync } from 'fs'
import { logger } from '../utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// db/client.ts — better-sqlite3 singleton + migration runner
//
// Why singleton? better-sqlite3 is synchronous and connection-per-process.
// A single shared instance is safe and avoids "database is locked" errors.
// ─────────────────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null

/** Returns the singleton DB instance. Call initDb() before using this. */
export function getDb(): Database.Database {
  if (!_db) throw new Error('DB not initialised — call initDb() first')
  return _db
}

/**
 * Opens the database file (in userData so it persists across app updates),
 * enables WAL mode + foreign keys, then applies any pending SQL migrations.
 */
export async function initDb(): Promise<void> {
  const dbPath = join(app.getPath('userData'), 'coders-note.sqlite')
  logger.info(`Opening database at: ${dbPath}`)

  _db = new Database(dbPath, {
    // verbose: (msg) => logger.debug(msg)  // uncomment for SQL logging
  })

  // Always-on pragmas
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = OFF')
  _db.pragma('synchronous = NORMAL')  // WAL + NORMAL = safe & fast

  await runMigrations(_db)

  // Seed default settings if the table is empty
  seedDefaultSettings(_db)

  logger.info('Database ready')
}

// ── Migration runner ──────────────────────────────────────────────────────────

/**
 * Scans migrations/ dir for *.sql files in alphabetical order.
 * Only applies files not yet recorded in _migrations table.
 * Runs each migration in a transaction so partial failures are rolled back.
 */
function getMigrationsDir(): string {
  // In dev: electron-vite bundles to out/main/index.js — __dirname = out/main/
  // The source migrations live at <projectRoot>/electron/db/migrations/
  // In prod: migrations are copied next to the bundle or resources, so fallback accordingly.
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    return join(app.getAppPath(), 'electron', 'db', 'migrations')
  }
  return join(__dirname, 'migrations')
}

function runMigrations(db: Database.Database): void {
  // The _migrations table might not exist yet on first run — create it inline
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT    PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)

  const migrationsDir = getMigrationsDir()
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()                             // alphabetical → 001 before 002

  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map((r: any) => r.filename)
  )

  for (const file of files) {
    if (applied.has(file)) {
      logger.debug(`Migration already applied: ${file}`)
      continue
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    logger.info(`Applying migration: ${file}`)

    // Wrap in a transaction — if the SQL throws, nothing is committed
    const applyMigration = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)').run(
        file,
        Math.floor(Date.now() / 1000)
      )
    })

    applyMigration()
    logger.info(`Migration applied: ${file}`)
  }
}

// ── Default settings seed ─────────────────────────────────────────────────────

const DEFAULTS: Record<string, string> = {
  theme:                       'light',
  defaultHandle:               '',
  defaultPlatform:             'codeforces',
  notificationsEnabled:        'true',
  reminderLeadMinutes:         '30',
  cacheRefreshIntervalMinutes: '20',
}

function seedDefaultSettings(db: Database.Database): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  )
  const seedAll = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULTS)) {
      insert.run(key, value)
    }
  })
  seedAll()
}
