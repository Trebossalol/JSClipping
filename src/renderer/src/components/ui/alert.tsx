import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
        info:
          "bg-blue-50 text-blue-900 border-blue-200 *:data-[slot=alert-description]:text-blue-800 *:[svg]:text-blue-400 " +
          "dark:bg-[linear-gradient(to_bottom_left,#13213b,#101624)] dark:text-blue-200 dark:border-blue-800/60 dark:*:data-[slot=alert-description]:text-blue-300 dark:*:[svg]:text-blue-500",
        success:
          "bg-green-50 text-green-900 border-green-200 *:data-[slot=alert-description]:text-green-800 *:[svg]:text-green-400 " +
          "dark:bg-[linear-gradient(to_bottom_left,#14271c,#102018)] dark:text-green-200 dark:border-green-800/60 dark:*:data-[slot=alert-description]:text-green-300 dark:*:[svg]:text-green-500",
        warning:
          "bg-yellow-50 text-yellow-900 border-yellow-200 *:data-[slot=alert-description]:text-yellow-800 *:[svg]:text-yellow-400 " +
          "dark:bg-[linear-gradient(to_bottom_left,#282208,#181509)] dark:text-yellow-100 dark:border-yellow-900/60 dark:*:data-[slot=alert-description]:text-yellow-200 dark:*:[svg]:text-yellow-500",
        error:
          "bg-red-50 text-red-900 border-red-200 *:data-[slot=alert-description]:text-red-800 *:[svg]:text-red-400 " +
          "dark:bg-[linear-gradient(to_bottom_left,#2a1317,#180c10)] dark:text-red-200 dark:border-red-800/60 dark:*:data-[slot=alert-description]:text-red-300 dark:*:[svg]:text-red-500",
      },


    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
