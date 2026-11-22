import { storageService } from './services/storage.service'
import { notificationService } from './services/notification.service'
import { logger } from './utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// scheduler.ts — Polls for due contest reminders every 60 seconds (zero DB).
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60 * 1000

let intervalId: NodeJS.Timeout | null = null

export function startScheduler(): void {
  if (intervalId) return

  logger.info('Reminder scheduler started (polling every 60s)')
  checkReminders()
  intervalId = setInterval(checkReminders, POLL_INTERVAL_MS)
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
    logger.info('Reminder scheduler stopped')
  }
}

function checkReminders(): void {
  try {
    const settings = storageService.getSettings()
    if (!settings.notificationsEnabled) return

    const reminders = storageService.getReminders()
    const nowSec = Math.floor(Date.now() / 1000)

    for (const [contestId, remindAt] of Object.entries(reminders)) {
      if (remindAt <= nowSec) {
        logger.info(`Firing reminder for contest: ${contestId}`)

        notificationService.send(
          '🏆 Contest Reminder — Coders Note',
          `Your tracked contest (${contestId}) is starting soon!`
        )

        // Clean up fired reminder
        storageService.removeReminder(contestId)
      }
    }
  } catch (err) {
    logger.error('Scheduler error during reminder check:', err)
  }
}
