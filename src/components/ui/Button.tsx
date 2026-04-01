import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "../../utils/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-primary/20 active:scale-[0.98] hover:scale-[1.02]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:brightness-110 shadow-sm rounded-xl",
        secondary: "bg-white dark:bg-card text-foreground border border-secondary hover:bg-secondary rounded-xl",
        ghost: "bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground rounded-xl",
        destructive: "bg-destructive text-white hover:brightness-110 shadow-sm rounded-xl",
        link: "text-primary hover:underline underline-offset-4",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-lg",
        default: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base rounded-xl",
        icon: "size-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "link"
type ButtonSize = "sm" | "default" | "lg" | "icon"

export interface ButtonProps extends Omit<React.ComponentProps<"button">, "size"> {
  asChild?: boolean
  variant?: ButtonVariant | "coral" | "outline" | "default"
  size?: ButtonSize | "icon-sm"
}

// Backward compatibility: map old variants to new ones
const legacyVariantMap: Record<string, ButtonVariant> = {
  coral: "primary",
  outline: "secondary",
  default: "primary",
}

const legacySizeMap: Record<string, ButtonSize> = {
  "icon-sm": "icon",
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    // Map legacy variants
    const mappedVariant: ButtonVariant | undefined = variant && legacyVariantMap[variant as string]
      ? legacyVariantMap[variant as string]
      : variant as ButtonVariant | undefined

    // Map legacy sizes
    const mappedSize: ButtonSize | undefined = size && legacySizeMap[size as string]
      ? legacySizeMap[size as string]
      : size as ButtonSize | undefined

    return (
      <Comp
        className={cn(buttonVariants({ variant: mappedVariant, size: mappedSize, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
