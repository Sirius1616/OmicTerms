import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  sessionNotifications,
  useSessionNotifications,
} from "@/hooks/useSessionNotifications"
import { cn } from "@/lib/utils"

/**
 * Story 12 — the notifications bell lists current-session events only
 * (upload outcomes today) and clears them when the menu is read. With no
 * session events the Story 1 honest empty state stays visible; fake system
 * notifications never render here.
 */
export function NotificationsBell() {
  const items = useSessionNotifications()

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        // Reading clears: events stay visible while the menu is open and are
        // cleared when the menu is closed again.
        if (!open && items.length > 0) {
          sessionNotifications.markAllRead()
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative text-muted-foreground"
          data-testid="notifications-bell"
        >
          <Bell className="size-4" />
          {items.length > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white"
              data-testid="notifications-count"
            >
              {items.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      {/* AC4: the count is announced politely whenever it changes. */}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        data-testid="notifications-live-count"
      >
        {items.length === 0
          ? "No new notifications"
          : `${items.length} new notification${items.length === 1 ? "" : "s"}`}
      </span>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
            <Bell className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">You’re all caught up</p>
            <p className="text-xs text-muted-foreground">
              Upload, analysis, and report notifications will appear here.
            </p>
          </div>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                data-testid="notification-item"
                className={cn(
                  "flex flex-col gap-0.5 rounded-md px-3 py-2",
                  item.kind === "error" ? "bg-destructive/10" : "bg-valid/10",
                )}
              >
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-block size-1.5 rounded-full",
                      item.kind === "error" ? "bg-destructive" : "bg-valid",
                    )}
                  />
                  {item.title}
                </span>
                {item.body ? (
                  <span className="truncate text-[11px] text-muted-foreground">
                    {item.body}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
