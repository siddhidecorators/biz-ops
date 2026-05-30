import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Semantic status pill. One source of truth for paid/partial/overdue/etc. so
// status colour is consistent everywhere (lists, detail headers, dashboard).
const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap ring-1 ring-inset [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground ring-border",
        brand: "bg-brand-tint text-brand-strong ring-brand/20",
        success: "bg-success-tint text-success-strong ring-success/25",
        warning: "bg-warning-tint text-warning-strong ring-warning/30",
        danger: "bg-destructive-tint text-destructive ring-destructive/25",
        outline: "bg-transparent text-foreground ring-border",
      },
      size: {
        default: "px-2 py-0.5 text-[11px]",
        sm: "px-1.5 py-px text-[10px]",
      },
    },
    defaultVariants: { variant: "neutral", size: "default" },
  }
)

function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
