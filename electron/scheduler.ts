import { contestsRepo } from './db/repositories/contests.repo'
import { notificationService } from './services/notification.service'
import { logger } from './utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// scheduler.ts — Polls for due reminders every 60 seconds.
// Keeps running in the background so notifications fire even when the
// user hasn't opened the app window.
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60 * 1000  // 1 minute

let intervalId: NodeJS.Timeout | null = null

export function startScheduler(): void {
  if (intervalId) return  // already running

  logger.info('Reminder scheduler started (polling every 60s)')

  // Run immediately on start, then on interval
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
    const due = contestsRepo.getDueReminders()

    for (const reminder of due) {
      logger.info(`Firing reminder for contest: ${reminder.contestId}`)

      // Find the contest in cache to get its title and URL
      const contests = contestsRepo.findAll()
      const contest = contests.find(c => c.id === reminder.contestId)

      if (contest) {
        const nowSec = Math.floor(Date.now() / 1000)
        const minutesUntil = Math.max(0, Math.round((contest.startTime - nowSec) / 60))
        notificationService.contestReminder(contest.title, minutesUntil, contest.url)
      } else {
        // Contest no longer in cache — send generic reminder
        notificationService.send(
          '🏆 Contest Reminder — Coders Note',
          'A contest you were following is starting soon!'
        )
      }

      contestsRepo.markReminderFired(reminder.id)
    }
  } catch (err) {
    logger.error('Scheduler error during reminder check', err)
  }
}
