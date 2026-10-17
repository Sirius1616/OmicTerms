import type { LucideIcon } from "lucide-react"
import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface QuickActionProps extends React.ComponentProps<"button"> {
  icon: LucideIcon
  label: string
  description?: string
  /** When set, the action renders disabled and shows this reason in a tooltip. */
  disabledReason?: string
}

const QuickAction = React.forwardRef<HTMLButtonElement, QuickActionProps>(
  function QuickAction(
    { icon: Icon, label, description, disabledReason, className, ...props },
    ref,
  ) {
    const isDisabled = Boolean(disabledReason)

    const button = (
      <button
        ref={ref}
        type="button"
        aria-disabled={isDisabled || undefined}
        disabled={isDisabled}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg border bg-background/40 px-3 py-2.5 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isDisabled
            ? "cursor-not-allowed opacity-55"
            : "hover:border-primary/40 hover:bg-accent",
          className,
        )}
        {...props}
      >
        <span className="mt-0.5 rounded-md bg-muted p-1.5">
          <Icon className="size-4 text-muted-foreground" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          {description ? (
            <span className="block text-xs text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
      </button>
    )

    if (isDisabled) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex w-full cursor-not-allowed">
              {button}
            </span>
          </TooltipTrigger>
          <TooltipContent>{disabledReason}</TooltipContent>
        </Tooltip>
      )
    }

    return button
  },
)

export { QuickAction }
