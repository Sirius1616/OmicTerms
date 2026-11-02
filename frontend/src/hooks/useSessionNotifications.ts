import { useSyncExternalStore } from "react"

/**
 * Story 12 — in-app session notifications. Client-side only, no persistence:
 * items exist only for the current session (today: upload outcomes), and the
 * bell clears them when they are read. No fake system notifications ever
 * enter this stream.
 */

export type NotificationItem = {
  id: string
  title: string
  body?: string
  kind: "success" | "error"
  at: string
}

let items: NotificationItem[] = []
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export const sessionNotifications = {
  push(item: Omit<NotificationItem, "id" | "at"> & { at?: string }): void {
    items = [
      ...items,
      {
        id: crypto.randomUUID(),
        at: item.at ?? new Date().toISOString(),
        ...item,
      },
    ]
    emit()
  },
  /** Reading the bell clears the unread queue (session toasts remain listable). */
  markAllRead(): void {
    if (items.length === 0) return
    items = []
    emit()
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  snapshot(): NotificationItem[] {
    return items
  },
}

export function useSessionNotifications(): NotificationItem[] {
  return useSyncExternalStore(
    sessionNotifications.subscribe,
    sessionNotifications.snapshot,
    sessionNotifications.snapshot,
  )
}
