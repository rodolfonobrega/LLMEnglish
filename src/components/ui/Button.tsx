import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "../../utils/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-primary/20",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-hover shadow-sm",
        secondary: "bg-secondary text-foreground border border-border hover:bg-muted",
        ghost: "bg-transparent text-foreground hover:bg-muted",
        destructive: "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-md",
        default: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base rounded-xl",
        icon: "size-9 rounded-lg",
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
  coral: "destructive",
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
