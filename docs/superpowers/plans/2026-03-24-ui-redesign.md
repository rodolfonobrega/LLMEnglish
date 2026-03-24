# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the entire SpeakLab application UI with a consistent Premium Dark + Playful Modern design system.

**Architecture:**
1. Replace all gradient-heavy "AI-looking" components with clean, solid-color alternatives
2. Create a unified design token system (CSS variables) for colors, spacing, typography, and borders
3. Update all components to use the new design tokens consistently
4. Maintain backward compatibility where possible, update usages where not

**Tech Stack:**
- React + TypeScript
- Tailwind CSS v4 (CSS-based configuration via @theme)
- CSS custom properties for design tokens
- Existing component library (shadcn-like)

**Note:** This project uses Tailwind CSS v4 with CSS-based configuration. There is no `tailwind.config.js` - configuration is done via the `@theme` directive in `src/index.css`.

---

## File Structure

**New/Modified Files:**
- `src/index.css` - Design tokens (CSS variables), utility classes, @theme directive
- `src/components/ui/Button.tsx` - Unified button variants
- `src/components/ui/card.tsx` - Base card component
- `src/components/ui/custom/ExerciseCard.tsx` - Redesigned exercise card (backward compatible)
- `src/components/ui/custom/PathCard.tsx` - Redesigned path card (backward compatible)
- `src/components/layout/Sidebar.tsx` - Consistent sidebar styling
- `src/components/layout/Navigation.tsx` - Consistent mobile nav
- `src/components/layout/Header.tsx` - Clean header design
- `src/components/discovery/DiscoveryPage.tsx` - Updated page layout
- `src/components/paths/PathsPage.tsx` - Updated paths page
- `src/components/shared/XPBadge.tsx` - Unified badge design (backward compatible)
- `src/components/ui/custom/ProgressBar.tsx` - Consistent progress bar
- `src/components/ui/Input.tsx` - Consistent input styling
- `src/components/ui/Textarea.tsx` - Consistent textarea styling
- `src/components/ui/Select.tsx` - Consistent select styling

---

## Task 1: Update Design Tokens (CSS Variables)

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace the entire CSS variables and @theme sections**

Read the current file first:
```bash
head -n 220 src/index.css
```

Then replace lines 4-209 (from `@layer base {` through `}`) with:

```css
@import "tailwindcss";
@import "tw-animate-css";

@layer base {
  :root {
    /* Base Colors - Light Mode Default */
    --background: 0 0% 98%;        /* #fafafa */
    --foreground: 0 0% 4%;         /* #09090b */

    /* Card & Surface */
    --card: 0 0% 100%;             /* #ffffff */
    --card-foreground: 0 0% 4%;    /* #09090b */
    --popover: 0 0% 100%;          /* #ffffff */
    --popover-foreground: 0 0% 4%; /* #09090b */

    /* Secondary Surface */
    --secondary: 0 0% 96%;         /* #f4f4f5 */
    --secondary-foreground: 0 0% 4%; /* #09090b */
    --muted: 0 0% 96%;             /* #f4f4f5 */
    --muted-foreground: 0 0% 45%;  /* #71717a */

    /* Accent */
    --accent: 0 0% 96%;            /* #f4f4f5 */
    --accent-foreground: 0 0% 4%;  /* #09090b */

    /* Destructive */
    --destructive: 0 84% 60%;      /* #ef4444 */
    --destructive-foreground: 0 0% 98%; /* #fafafa */

    /* Borders & Inputs */
    --border: 0 0% 90%;            /* #e4e4e7 */
    --input: 0 0% 90%;             /* #e4e4e7 */
    --ring: 217 91% 60%;           /* #3b82f6 */

    /* Radius */
    --radius: 0.75rem;             /* 12px */

    /* Sidebar */
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 0 0% 4%;
    --sidebar-primary: 0 0% 4%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 0 0% 96%;
    --sidebar-accent-foreground: 0 0% 4%;
    --sidebar-border: 0 0% 90%;
    --sidebar-ring: 217 91% 60%;

    /* Brand Colors (Solid) */
    --brand-primary: 217 91% 60%;      /* #3b82f6 - Blue */
    --brand-primary-hover: 217 91% 55%; /* #2563eb */
    --brand-success: 142 76% 36%;       /* #22c55e - Green */
    --brand-warning: 25 95% 53%;        /* #f97316 - Orange */
    --brand-danger: 0 84% 60%;          /* #ef4444 - Red */
    --brand-special: 258 90% 66%;       /* #8b5cf6 - Purple */

    /* Brand Soft Backgrounds */
    --brand-primary-soft: 217 91% 60% / 0.1;
    --brand-success-soft: 142 76% 36% / 0.1;
    --brand-warning-soft: 25 95% 53% / 0.1;
    --brand-danger-soft: 0 84% 60% / 0.1;
    --brand-special-soft: 258 90% 66% / 0.1;

    /* Z-index */
    --z-header: 40;
    --z-nav: 40;
    --z-modal: 50;
    --z-toast: 60;
  }

  .dark {
    /* Base Colors - Dark Mode */
    --background: 0 0% 4%;         /* #09090b */
    --foreground: 0 0% 98%;        /* #fafafa */

    /* Card & Surface */
    --card: 0 0% 10%;              /* #18181b */
    --card-foreground: 0 0% 98%;   /* #fafafa */
    --popover: 0 0% 10%;           /* #18181b */
    --popover-foreground: 0 0% 98%; /* #fafafa */

    /* Secondary Surface */
    --secondary: 0 0% 16%;         /* #27272a */
    --secondary-foreground: 0 0% 98%; /* #fafafa */
    --muted: 0 0% 16%;             /* #27272a */
    --muted-foreground: 0 0% 63%;  /* #a1a1aa */

    /* Accent */
    --accent: 0 0% 16%;            /* #27272a */
    --accent-foreground: 0 0% 98%; /* #fafafa */

    /* Destructive */
    --destructive: 0 84% 60%;      /* #ef4444 */
    --destructive-foreground: 0 0% 98%; /* #fafafa */

    /* Borders & Inputs */
    --border: 0 0% 16%;            /* #27272a */
    --input: 0 0% 16%;             /* #27272a */
    --ring: 217 91% 60%;           /* #3b82f6 */

    /* Sidebar */
    --sidebar-background: 0 0% 10%;
    --sidebar-foreground: 0 0% 98%;
    --sidebar-primary: 217 91% 60%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 0 0% 16%;
    --sidebar-accent-foreground: 0 0% 98%;
    --sidebar-border: 0 0% 16%;
    --sidebar-ring: 217 91% 60%;
  }
}

@theme {
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));

  --color-primary: hsl(var(--brand-primary));
  --color-primary-hover: hsl(var(--brand-primary-hover));
  --color-primary-soft: hsl(var(--brand-primary-soft));

  --color-success: hsl(var(--brand-success));
  --color-success-soft: hsl(var(--brand-success-soft));
  --color-warning: hsl(var(--brand-warning));
  --color-warning-soft: hsl(var(--brand-warning-soft));
  --color-danger: hsl(var(--brand-danger));
  --color-danger-soft: hsl(var(--brand-danger-soft));
  --color-special: hsl(var(--brand-special));
  --color-special-soft: hsl(var(--brand-special-soft));

  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));

  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));

  --radius-sm: 0.375rem;   /* 6px */
  --radius-md: 0.5rem;     /* 8px */
  --radius-lg: 0.75rem;    /* 12px */
  --radius-xl: 1rem;       /* 16px */
  --radius-2xl: 1.25rem;   /* 20px */
  --radius-full: 9999px;

  /* Animations */
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;

  @keyframes accordion-down {
    from { height: 0; }
    to { height: var(--radix-accordion-content-height); }
  }

  @keyframes accordion-up {
    from { height: var(--radix-accordion-content-height); }
    to { height: 0; }
  }
}
```

- [ ] **Step 2: Update base layer and utility classes**

Replace the `@layer base` section and utilities (from line 211 onwards) with:

```css
/* Base */
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Scrollbar */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: hsl(var(--muted));
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground));
}

/* Card Hover Effect */
.card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.dark .card-hover:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
}

/* Card with Top Accent */
.card-accent {
  position: relative;
  overflow: hidden;
}

.card-accent::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, hsl(var(--brand-primary)), hsl(var(--brand-special)));
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

/* Card with Hover Border */
.card-hover-border {
  transition: border-color 0.2s ease;
}

.card-hover-border:hover {
  border-color: hsl(var(--brand-primary) / 0.5);
}

/* Message Entrance Animation */
@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-message-in {
  animation: message-in 0.3s ease-out;
}

/* Progress Indeterminate */
@keyframes progress-indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-progress-indeterminate {
  animation: progress-indeterminate 1.5s ease-in-out infinite;
}

/* Safe Area */
@supports (padding-top: env(safe-area-inset-top)) {
  .safe-area-top {
    padding-top: env(safe-area-inset-top);
  }

  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

- [ ] **Step 3: Verify CSS compiles**

Run: `npm run dev`

Expected: Application starts without CSS errors, colors are updated

- [ ] **Step 4: Commit CSS changes**

```bash
git add src/index.css
git commit -m "feat: update design tokens for UI redesign"
```

---

## Task 2: Redesign Button Component

**Files:**
- Modify: `src/components/ui/Button.tsx`

- [ ] **Step 1: Update button variants**

Read current file:
```bash
cat src/components/ui/Button.tsx
```

Replace the `buttonVariants` definition (approximately lines 7-40) with:

```tsx
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
```

- [ ] **Step 2: Test buttons visually**

Run: `npm run dev` and check button styling in the browser

Expected: All buttons use new variants (primary, secondary, ghost, destructive)

- [ ] **Step 3: Commit button changes**

```bash
git add src/components/ui/Button.tsx
git commit -m "feat: redesign button component with unified variants"
```

---

## Task 3: Redesign Exercise Card (Backward Compatible)

**Files:**
- Modify: `src/components/ui/custom/ExerciseCard.tsx`

- [ ] **Step 1: Update ExerciseCard with backward-compatible API**

Read current file:
```bash
cat src/components/ui/custom/ExerciseCard.tsx
```

Replace the entire file with:

```tsx
import { cn } from '../../../utils/cn';

// Type for gradient colors (backward compatibility)
type GradientColor =
  | 'from-sky-400 to-blue-500'
  | 'from-violet-400 to-purple-500'
  | 'from-emerald-400 to-teal-500'
  | 'from-amber-400 to-orange-500'
  | 'from-rose-400 to-pink-500';

// New accent color type
type AccentColor = 'primary' | 'success' | 'warning' | 'danger' | 'special';

interface ExerciseCardProps {
  title: string;
  description: string;
  emoji: string;
  gradient?: GradientColor;  // Backward compatible
  accentColor?: AccentColor;  // New API
  progress?: number;
  onClick?: () => void;
}

// Map old gradient names to new accent colors
function getAccentFromGradient(grad?: GradientColor): AccentColor {
  if (!grad) return 'primary';
  if (grad.includes('sky') || grad.includes('blue')) return 'primary';
  if (grad.includes('emerald') || grad.includes('teal') || grad.includes('green')) return 'success';
  if (grad.includes('amber') || grad.includes('orange')) return 'warning';
  if (grad.includes('rose') || grad.includes('pink') || grad.includes('red')) return 'danger';
  if (grad.includes('violet') || grad.includes('purple')) return 'special';
  return 'primary';
}

export function ExerciseCard({ title, description, emoji, gradient, accentColor, progress, onClick }: ExerciseCardProps) {
  // Use accentColor if provided, otherwise derive from gradient for backward compatibility
  const effectiveColor = accentColor ?? getAccentFromGradient(gradient);

  const colorMap = {
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    special: 'bg-special-soft text-special',
  };

  const accentGradient = {
    primary: 'bg-gradient-to-r from-primary to-special',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    special: 'bg-special',
  };

  return (
    <div
      onClick={onClick}
      className={`
        group relative overflow-hidden rounded-xl border border-border bg-card
        transition-all duration-200 card-hover card-hover-border
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Top Accent Line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-0.5",
        accentGradient[effectiveColor]
      )} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className={cn(
            "size-12 rounded-lg flex items-center justify-center text-2xl",
            colorMap[effectiveColor]
          )}>
            {emoji}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-semibold text-base mb-1">{title}</h3>
            <p className="text-muted-foreground text-sm line-clamp-2">{description}</p>
          </div>
        </div>

        {/* Progress */}
        {progress !== undefined && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progress === 100 ? 'bg-success' : 'bg-primary'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-muted-foreground text-xs font-medium min-w-[32px]">{progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test ExerciseCard**

Run: `npm run dev` and check ExerciseCard displays correctly

Expected: Existing cards with `gradient` prop still work, new `accentColor` prop also works

- [ ] **Step 3: Commit ExerciseCard changes**

```bash
git add src/components/ui/custom/ExerciseCard.tsx
git commit -m "feat: redesign ExerciseCard with backward compatible API"
```

---

## Task 4: Redesign Path Card (Backward Compatible)

**Files:**
- Modify: `src/components/ui/custom/PathCard.tsx`

- [ ] **Step 1: Update PathCard with backward-compatible API**

Read current file:
```bash
cat src/components/ui/custom/PathCard.tsx
```

Replace the entire file with:

```tsx
import { ChevronRight, Star } from 'lucide-react';
import { cn } from '../../../utils/cn';

// Type for gradient colors (backward compatibility)
type GradientColor =
  | 'from-sky-400 to-blue-500'
  | 'from-violet-400 to-purple-500'
  | 'from-emerald-400 to-teal-500'
  | 'from-amber-400 to-orange-500'
  | 'from-rose-400 to-pink-500';

// New accent color type
type AccentColor = 'primary' | 'success' | 'warning' | 'danger' | 'special';

interface PathCardProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  gradient?: GradientColor;  // Backward compatible
  accentColor?: AccentColor;  // New API
  xpRange?: string;
  progress?: number;
  stepsDone?: number;
  stepsTotal?: number;
  onClick?: () => void;
  className?: string;
}

// Map old gradient names to new accent colors
function getAccentFromGradient(grad?: GradientColor): AccentColor {
  if (!grad) return 'primary';
  if (grad.includes('sky') || grad.includes('blue')) return 'primary';
  if (grad.includes('emerald') || grad.includes('teal') || grad.includes('green')) return 'success';
  if (grad.includes('amber') || grad.includes('orange')) return 'warning';
  if (grad.includes('rose') || grad.includes('pink') || grad.includes('red')) return 'danger';
  if (grad.includes('violet') || grad.includes('purple')) return 'special';
  return 'primary';
}

export function PathCard({
  title,
  subtitle,
  emoji,
  gradient,
  accentColor,
  xpRange,
  progress,
  stepsDone,
  stepsTotal,
  onClick,
  className,
}: PathCardProps) {
  // Use accentColor if provided, otherwise derive from gradient for backward compatibility
  const effectiveColor = accentColor ?? getAccentFromGradient(gradient);

  const colorMap = {
    primary: {
      icon: 'bg-primary-soft text-primary',
      badge: 'bg-primary-soft text-primary border-primary/20',
    },
    success: {
      icon: 'bg-success-soft text-success',
      badge: 'bg-success-soft text-success border-success/20',
    },
    warning: {
      icon: 'bg-warning-soft text-warning',
      badge: 'bg-warning-soft text-warning border-warning/20',
    },
    danger: {
      icon: 'bg-danger-soft text-danger',
      badge: 'bg-danger-soft text-danger border-danger/20',
    },
    special: {
      icon: 'bg-special-soft text-special',
      badge: 'bg-special-soft text-special border-special/20',
    },
  };

  const colors = colorMap[effectiveColor];

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-card',
        'transition-all duration-200 card-hover card-hover-border',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {/* Top Accent Line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-0.5",
        effectiveColor === 'primary' && 'bg-gradient-to-r from-primary to-special',
        effectiveColor === 'success' && 'bg-success',
        effectiveColor === 'warning' && 'bg-warning',
        effectiveColor === 'danger' && 'bg-danger',
        effectiveColor === 'special' && 'bg-special',
      )} />

      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn(
            "size-12 rounded-lg flex items-center justify-center text-2xl",
            colors.icon
          )}>
            {emoji || '📘'}
          </div>

          {xpRange && (
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold",
              colors.badge
            )}>
              <Star className="w-3 h-3 fill-current" />
              <span>{xpRange} XP</span>
            </div>
          )}
        </div>

        <h3 className="text-foreground font-semibold text-base mb-1">{title}</h3>
        {subtitle && <p className="text-muted-foreground text-sm mb-4">{subtitle}</p>}

        {/* Progress */}
        {progress != null && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  progress === 100 ? 'bg-success' : 'bg-primary'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            {stepsDone != null && stepsTotal != null ? (
              <span className="text-muted-foreground text-xs font-medium min-w-[32px]">{stepsDone}/{stepsTotal}</span>
            ) : (
              <span className="text-muted-foreground text-xs font-medium min-w-[32px]">{progress}%</span>
            )}
          </div>
        )}

        {/* Arrow on hover */}
        {onClick && (
          <div className="absolute bottom-4 right-4 size-8 bg-muted rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test PathCard**

Run: `npm run dev` and check PathsPage

Expected: Existing cards with `gradient` prop still work

- [ ] **Step 3: Commit PathCard changes**

```bash
git add src/components/ui/custom/PathCard.tsx
git commit -m "feat: redesign PathCard with backward compatible API"
```

---

## Task 5: Redesign XP Badge (Backward Compatible)

**Files:**
- Modify: `src/components/ui/custom/XPBadge.tsx`

- [ ] **Step 1: Update XPBadge with backward-compatible API**

Read current file:
```bash
cat src/components/ui/custom/XPBadge.tsx
```

Replace the entire file with:

```tsx
import { Star, Zap, Flame } from 'lucide-react';
import { cn } from '../../../utils/cn';

// New variants
type XPBadgeVariant = 'xp' | 'level' | 'streak';

interface XPBadgeProps {
  // New API
  variant?: XPBadgeVariant;
  value?: number | string;

  // Backward compatible
  amount?: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;

  className?: string;
}

const variantConfig = {
  xp: {
    icon: Star,
    bgColor: 'bg-warning-soft',
    textColor: 'text-warning',
  },
  level: {
    icon: Zap,
    bgColor: 'bg-primary-soft',
    textColor: 'text-primary',
  },
  streak: {
    icon: Flame,
    bgColor: 'bg-danger-soft',
    textColor: 'text-danger',
  },
} as const;

export function XPBadge({
  variant = 'xp',
  value,
  amount,
  size = 'md',
  showIcon = true,
  className,
}: XPBadgeProps) {
  // Backward compatibility: if amount is provided, treat as xp variant
  const effectiveVariant = amount !== undefined ? 'xp' : variant;
  const effectiveValue = amount !== undefined ? `+${amount} XP` : value;

  const config = variantConfig[effectiveVariant];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-lg",
      config.bgColor,
      config.textColor,
      sizeClasses[size],
      "font-semibold",
      className
    )}>
      {showIcon && <Icon className="w-4 h-4 fill-current" />}
      <span>
        {effectiveVariant === 'level' && 'Lv.'}{effectiveValue}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Test XPBadge**

Run: `npm run dev` and check badges in Header

Expected: Both old `amount` prop and new `variant`/`value` props work

- [ ] **Step 3: Commit XPBadge changes**

```bash
git add src/components/ui/custom/XPBadge.tsx
git commit -m "feat: redesign XPBadge with backward compatible API"
```

---

## Task 6: Redesign Progress Bar

**Files:**
- Modify: `src/components/ui/custom/ProgressBar.tsx`

- [ ] **Step 1: Update ProgressBar**

Read current file:
```bash
cat src/components/ui/custom/ProgressBar.tsx
```

Replace the entire file with:

```tsx
import { cn } from '../../../utils/cn';

interface ProgressBarProps {
  current: number;
  max: number;
  level?: number;
  streak?: number;
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({ current, max, level, streak, showLabel = true, className }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (current / max) * 100));

  return (
    <div className={cn("space-y-3", className)}>
      {/* Level and Streak Badges */}
      {(level !== undefined || streak !== undefined) && (
        <div className="flex items-center gap-2">
          {level !== undefined && (
            <span className="text-sm font-semibold text-primary">Level {level}</span>
          )}
          {streak !== undefined && streak > 0 && (
            <span className="text-sm font-semibold text-danger">🔥 {streak} dias</span>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              percentage === 100 ? 'bg-success' : 'bg-primary'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {showLabel && (
          <span className="text-xs text-muted-foreground mt-1.5 block">
            {current} / {max} XP
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test ProgressBar**

Run: `npm run dev` and check DiscoveryPage

Expected: Progress bar displays with new styling

- [ ] **Step 3: Commit ProgressBar changes**

```bash
git add src/components/ui/custom/ProgressBar.tsx
git commit -m "feat: redesign ProgressBar with minimal style"
```

---

## Task 7: Update Sidebar Styling

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Update Sidebar navigation styling**

Read current file:
```bash
cat src/components/layout/Sidebar.tsx
```

Update the nav section (find the `<nav>` element, approximately lines 44-74) with:

```tsx
<nav className="flex-1 px-3">
  <ul className="space-y-1">
    {navItems.map((item) => {
      const Icon = item.icon;
      return (
        <li key={item.to}>
          <NavLink
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                isActive
                  ? "bg-primary-soft text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )
            }
            children={({ isActive }) => (
              <>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 bg-primary rounded-full" />
                )}
              </>
            )}
          />
        </li>
      );
    })}
  </ul>
</nav>
```

- [ ] **Step 2: Update streak card styling**

Find and replace the streak card section (near the end of the component) with:

```tsx
{stats && stats.streak > 0 && (
  <div className="p-3 border-t border-border">
    <div className="bg-danger-soft border border-danger/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Flame className="w-4 h-4 text-danger fill-danger" />
        <span className="font-semibold text-sm text-danger">{stats.streak} dias seguidos!</span>
      </div>
      <p className="text-xs text-muted-foreground">Continue assim! Você está indo muito bem.</p>
    </div>
  </div>
)}
```

- [ ] **Step 3: Test Sidebar**

Run: `npm run dev` and check sidebar on desktop view

Expected: Navigation items have new hover/active states, streak card uses new colors

- [ ] **Step 4: Commit Sidebar changes**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: update Sidebar styling with new design system"
```

---

## Task 8: Update Navigation (Mobile)

**Files:**
- Modify: `src/components/layout/Navigation.tsx`

- [ ] **Step 1: Update Navigation component**

Read current file:
```bash
cat src/components/layout/Navigation.tsx
```

Replace the entire file with:

```tsx
import { NavLink } from 'react-router-dom';
import { Compass, RotateCcw, Mic, Map, Sparkles, FileText, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';

const navItems = [
  { to: '/', icon: Compass, label: 'Início' },
  { to: '/exercises', icon: Sparkles, label: 'Exercícios' },
  { to: '/paths', icon: Map, label: 'Trilhas' },
  { to: '/live', icon: Mic, label: 'Simulação' },
  { to: '/review', icon: RotateCcw, label: 'Revisão' },
  { to: '/scripts', icon: FileText, label: 'Scripts' },
  { to: '/settings', icon: Settings, label: 'Config' },
];

export function Navigation() {
  return (
    <nav
      aria-label="Main navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-40 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer min-w-[3rem]',
                isActive
                  ? 'text-primary bg-primary-soft'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <item.icon size={20} strokeWidth={2} />
            <span className="text-[10px] font-medium leading-tight">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Test Navigation**

Run: `npm run dev` and check mobile navigation (resize browser or use mobile view)

Expected: Active nav item has primary color background, items use new styling

- [ ] **Step 3: Commit Navigation changes**

```bash
git add src/components/layout/Navigation.tsx
git commit -m "feat: update Navigation styling with new design system"
```

---

## Task 9: Update Header Styling

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Update Header to use new XPBadge**

Read current file:
```bash
cat src/components/layout/Header.tsx
```

Replace the stats badges section (lines 56-79) with:

```tsx
{/* User Stats */}
<div className="flex items-center gap-2">
  {stats && (
    <>
      {/* XP - Hidden on mobile */}
      <div className="hidden sm:block">
        <XPBadge variant="xp" value={stats.xp} />
      </div>

      {/* Level - Hidden on mobile */}
      <div className="hidden sm:block">
        <XPBadge variant="level" value={stats.level} />
      </div>

      {/* Streak */}
      {stats.streak > 0 && (
        <XPBadge variant="streak" value={stats.streak} />
      )}
    </>
  )}

  {/* Theme Toggle */}
  <button
    onClick={cycle}
    aria-label={`Theme: ${theme}. Click to change.`}
    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
  >
    <ThemeIcon size={20} />
  </button>
</div>
```

- [ ] **Step 2: Add XPBadge import**

Add to imports at top of file:
```tsx
import { XPBadge } from '../ui/custom/XPBadge';
```

- [ ] **Step 3: Test Header**

Run: `npm run dev` and check header displays correctly

Expected: XP, Level, and Streak badges use new XPBadge component

- [ ] **Step 4: Commit Header changes**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: update Header with new XPBadge component"
```

---

## Task 10: Update Discovery Page Layout

**Files:**
- Modify: `src/components/discovery/DiscoveryPage.tsx`

- [ ] **Step 1: Update quickActions with new color classes**

Read current file:
```bash
cat src/components/discovery/DiscoveryPage.tsx
```

Update the `quickActions` array (approximately lines 19-28) with:

```tsx
const quickActions: QuickAction[] = [
  { to: '/exercises', icon: Sparkles, label: 'Exercícios', description: 'Frases, textos e situações', color: 'bg-warning-soft', hoverBorder: 'hover:border-warning/30' },
  { to: '/paths', icon: Map, label: 'Trilhas', description: 'Cenários guiados passo a passo', color: 'bg-primary-soft', hoverBorder: 'hover:border-primary/30' },
  { to: '/live', icon: Mic, label: 'Simulação', description: 'Conversa em tempo real', color: 'bg-special-soft', hoverBorder: 'hover:border-special/30' },
  { to: '/review', icon: RotateCcw, label: 'Revisão', description: 'Repetição espaçada', color: 'bg-special-soft', hoverBorder: 'hover:border-special/30' },
  { to: '/scripts', icon: FileText, label: 'Scripts', description: 'Atue diálogos como um ator', color: 'bg-danger-soft', hoverBorder: 'hover:border-danger/30' },
  { to: '/library', icon: BookOpen, label: 'Flashcards', description: 'Sua coleção de cards', color: 'bg-success-soft', hoverBorder: 'hover:border-success/30' },
  { to: '/errors', icon: AlertTriangle, label: 'Erros', description: 'Acompanhe seus pontos fracos', color: 'bg-danger-soft', hoverBorder: 'hover:border-danger/30' },
  { to: '/history', icon: Clock, label: 'Histórico', description: 'Reveja conversas anteriores', color: 'bg-special-soft', hoverBorder: 'hover:border-special/30' },
];
```

- [ ] **Step 2: Update hero card styling**

Find the Live Roleplay Hero Card section (lines 64-99 approximately) and replace with:

```tsx
{/* Live Roleplay Hero Card */}
<section>
  <div className="bg-special-soft border border-special/20 rounded-xl p-5 relative overflow-hidden">
    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-special to-primary" />

    <div className="relative">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">🎭</span>
        <div className="px-2 py-1 bg-special/20 rounded-md">
          <span className="text-xs font-semibold text-special">60-130 XP</span>
        </div>
      </div>

      <h3 className="text-lg font-bold text-foreground mb-1">Simulação ao Vivo</h3>
      <p className="text-muted-foreground text-sm mb-4">Finja que é de verdade. Pratique com IA em tempo real.</p>

      <div className="flex gap-2">
        <button
          onClick={() => navigate('/live')}
          className="flex items-center gap-2 px-4 py-2 bg-special text-special-foreground rounded-lg font-semibold text-sm hover:bg-special/90 transition-colors cursor-pointer"
        >
          <Target className="w-4 h-4" />
          Cenário Aleatório
        </button>
        <button
          onClick={() => navigate('/live')}
          className="flex items-center gap-2 px-4 py-2 border border-border bg-card text-foreground rounded-lg font-semibold text-sm hover:bg-muted transition-colors cursor-pointer"
        >
          <Compass className="w-4 h-4" />
          Personalizado
        </button>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Test DiscoveryPage**

Run: `npm run dev` and check the DiscoveryPage

Expected: Hero card uses soft special color background, quick action buttons use new color classes

- [ ] **Step 4: Commit DiscoveryPage changes**

```bash
git add src/components/discovery/DiscoveryPage.tsx
git commit -m "feat: update DiscoveryPage with new styling"
```

---

## Task 11: Update Input Components

**Files:**
- Modify: `src/components/ui/Input.tsx`
- Modify: `src/components/ui/Textarea.tsx`

- [ ] **Step 1: Update Input component**

Read current file:
```bash
cat src/components/ui/Input.tsx
```

Replace the className in the Input component with:

```tsx
className={cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
  "file:border-0 file:bg-transparent file:text-sm file:font-medium",
  "placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
  error && "border-danger focus-visible:border-danger focus-visible:ring-danger/20",
  className
)}
```

- [ ] **Step 2: Update Textarea component**

Read current file:
```bash
cat src/components/ui/Textarea.tsx
```

Replace the className in the Textarea component with:

```tsx
className={cn(
  "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "resize-vertical",
  error && "border-danger focus-visible:border-danger focus-visible:ring-danger/20",
  className
)}
```

- [ ] **Step 3: Test input components**

Run: `npm run dev` and check forms with inputs/textareas

Expected: Inputs use new border and focus ring colors

- [ ] **Step 4: Commit input changes**

```bash
git add src/components/ui/Input.tsx src/components/ui/Textarea.tsx
git commit -m "feat: update Input and Textarea with new styling"
```

---

## Task 12: Final Review and Testing

**Files:**
- All modified files

- [ ] **Step 1: Run the application**

Run: `npm run dev`

Expected: Application starts without errors

- [ ] **Step 2: Visual regression checklist**

Verify each component displays correctly in both light and dark mode:
- [ ] Buttons (primary, secondary, ghost, destructive) - hover states work
- [ ] Cards (ExerciseCard, PathCard) - accent lines display, hover effects work
- [ ] Progress bars - colors are correct
- [ ] Badges (XP, Level, Streak) - use soft background colors
- [ ] Sidebar navigation - active/hover states use new colors
- [ ] Mobile navigation - active state has primary background
- [ ] Header with stats - badges display correctly
- [ ] Inputs and textareas - focus ring uses primary color
- [ ] Discovery page - hero card and quick actions use new styling
- [ ] Paths page - cards display with correct accent colors

- [ ] **Step 3: Test dark mode toggle**

Toggle between light and dark mode using the theme button

Expected: All colors adapt correctly to both modes

- [ ] **Step 4: Test responsive design**

Check mobile, tablet, and desktop breakpoints:
- Mobile (< 1024px): Bottom navigation visible, sidebar hidden
- Desktop (≥ 1024px): Sidebar visible, bottom navigation hidden

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete UI redesign with Premium Dark + Playful Modern design system"
```

---

## Implementation Notes

1. **Backward Compatibility**: ExerciseCard, PathCard, and XPBadge maintain backward compatibility with existing props while adding new accentColor API.

2. **Design Tokens**: All colors are now CSS variables in `src/index.css`. Use these tokens instead of hardcoded values:
   - `bg-primary-soft`, `bg-success-soft`, etc. for soft backgrounds
   - `text-primary`, `text-success`, etc. for text colors
   - `border-primary/30`, etc. for border colors with opacity

3. **Border Radius**: Use semantic values (`sm`, `md`, `lg`, `xl`, `2xl`, `full`) instead of arbitrary pixel values.

4. **Hover Effects**: All interactive cards use `card-hover` and `card-hover-border` classes for consistent behavior.

5. **Testing Strategy**: After each task, visually verify the changes work correctly. This is a UI redesign so visual testing is the primary verification method.

6. **Rollback Strategy**: Each task commits independently. If something breaks, you can rollback specific commits:
   ```bash
   git revert <commit-hash>
   ```

7. **Accent Color Mapping**:
   - Primary (blue) - main actions, links
   - Success (green) - completion, positive states
   - Warning (orange) - streaks, attention
   - Danger (red) - errors, destructive actions
   - Special (purple) - special features, secondary actions
