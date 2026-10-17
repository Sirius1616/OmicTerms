import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        valid: "border-valid/40 bg-valid/10 text-valid",
        warning: "border-warning/40 bg-warning/10 text-warning",
        error: "border-destructive/40 bg-destructive/10 text-destructive",
        info: "border-primary/40 bg-primary/10 text-primary",
        neutral: "border-border text-muted-foreground",
        pending:
          "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan gm-pulseglow",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
)

export type StatusBadgeVariant = NonNullable<
  VariantProps<typeof statusBadgeVariants>["variant"]
>

interface StatusBadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof statusBadgeVariants> {}

export function StatusBadge({
  className,
  variant,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ variant }), className)}
      {...props}
    >
      {children}
    </span>
  )
}

export { statusBadgeVariants }
