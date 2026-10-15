import { Notification } from 'electron'
import { logger } from '../utils/logger'

// ─────────────────────────────────────────────────────────────────────────────
// notification.service.ts — OS desktop notifications via Electron's
// Notification API. Requires OS-level permission (auto-granted on Windows,
// prompted on macOS). Test this early — don't discover permission issues demo day.
// ─────────────────────────────────────────────────────────────────────────────

export const notificationService = {
  isSupported(): boolean {
    return Notification.isSupported()
  },

  send(title: string, body: string, onClick?: () => void): void {
    if (!Notification.isSupported()) {
      logger.warn('Notifications not supported on this platform')
      return
    }

    const n = new Notification({
      title,
      body,
      icon: undefined,  // use app default icon
      silent: false,
    })

    if (onClick) {
      n.on('click', onClick)
    }

    n.show()
    logger.info(`Notification sent: "${title}"`)
  },

  contestReminder(contestTitle: string, minutesUntil: number, contestUrl: string): void {
    const body = minutesUntil <= 1
      ? `${contestTitle} is starting NOW!`
      : `${contestTitle} starts in ${minutesUntil} minutes`

    this.send(
      '🏆 Contest Reminder — Coders Note',
      body,
      () => {
        // Open contest URL in system browser on click
        import('electron').then(({ shell }) => shell.openExternal(contestUrl))
      }
    )
  },
}
