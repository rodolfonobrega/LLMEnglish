# SpeakLab UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign SpeakLab's UI with a colorful mode-based identity system, restructured navigation (6 sidebar items), and consistent templates across all pages.

**Architecture:** Foundation-first approach: add color tokens and reusable components first, then restructure navigation, then rebuild the Practice Hub, then refactor remaining pages. Each task produces a working, committable change.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Radix UI, Vitest, React Router

---

## Task 1: Add Mode Color Tokens to CSS

**Files:**
- Modify: `src/index.css:53-66` (light mode semantic aliases)
- Modify: `src/index.css:121-129` (dark mode semantic aliases)
- Modify: `src/index.css:157-164` (@theme color definitions)

- [ ] **Step 1: Add mode color variables to `:root` in `src/index.css`**

Add after the existing semantic aliases block (after line 63, before the `--danger` token):

```css
    /* Mode Colors */
    --mode-phrases: 258 90% 66%;
    --mode-phrases-soft: 258 90% 66% / 0.1;
    --mode-texts: 217 91% 60%;
    --mode-texts-soft: 217 91% 60% / 0.1;
    --mode-situations: 174 84% 39%;
    --mode-situations-soft: 174 84% 39% / 0.1;
    --mode-scripts: 25 95% 53%;
    --mode-scripts-soft: 25 95% 53% / 0.1;
    --mode-simulation: 142 71% 45%;
    --mode-simulation-soft: 142 71% 45% / 0.1;
    --mode-interview: 38 92% 50%;
    --mode-interview-soft: 38 92% 50% / 0.1;
    --mode-visual: 271 91% 65%;
    --mode-visual-soft: 271 91% 65% / 0.1;
```

- [ ] **Step 2: Add mode color variables to `.dark` in `src/index.css`**

Add after the existing dark mode semantic aliases block (after line 129):

```css
    /* Mode Colors (dark) */
    --mode-phrases: 258 90% 72%;
    --mode-phrases-soft: 258 90% 72% / 0.15;
    --mode-texts: 217 91% 65%;
    --mode-texts-soft: 217 91% 65% / 0.15;
    --mode-situations: 174 84% 50%;
    --mode-situations-soft: 174 84% 50% / 0.15;
    --mode-scripts: 25 95% 60%;
    --mode-scripts-soft: 25 95% 60% / 0.15;
    --mode-simulation: 142 71% 55%;
    --mode-simulation-soft: 142 71% 55% / 0.15;
    --mode-interview: 38 92% 60%;
    --mode-interview-soft: 38 92% 60% / 0.15;
    --mode-visual: 271 91% 72%;
    --mode-visual-soft: 271 91% 72% / 0.15;
```

- [ ] **Step 3: Add `@theme` color entries in `src/index.css`**

Add after the existing semantic color entries (after `--color-amber-soft` around line 164):

```css
  /* Mode Colors */
  --color-mode-phrases: hsl(var(--mode-phrases));
  --color-mode-phrases-soft: hsl(var(--mode-phrases-soft));
  --color-mode-texts: hsl(var(--mode-texts));
  --color-mode-texts-soft: hsl(var(--mode-texts-soft));
  --color-mode-situations: hsl(var(--mode-situations));
  --color-mode-situations-soft: hsl(var(--mode-situations-soft));
  --color-mode-scripts: hsl(var(--mode-scripts));
  --color-mode-scripts-soft: hsl(var(--mode-scripts-soft));
  --color-mode-simulation: hsl(var(--mode-simulation));
  --color-mode-simulation-soft: hsl(var(--mode-simulation-soft));
  --color-mode-interview: hsl(var(--mode-interview));
  --color-mode-interview-soft: hsl(var(--mode-interview-soft));
  --color-mode-visual: hsl(var(--mode-visual));
  --color-mode-visual-soft: hsl(var(--mode-visual-soft));
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds with no CSS errors.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat: add mode color tokens to CSS theme system"
```

---

## Task 2: Create Mode Configuration

**Files:**
- Create: `src/config/modes.ts`
- Create: `src/config/modes.test.ts`

- [ ] **Step 1: Write the failing test `src/config/modes.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import {
  exerciseModes,
  conversationModes,
  allModes,
  type PracticeMode,
} from './modes';

describe('exerciseModes', () => {
  it('has exactly 4 exercise modes in the correct order', () => {
    expect(exerciseModes.map(m => m.id)).toEqual([
      'phrases',
      'texts',
      'situations',
      'scripts',
    ]);
  });

  it('each mode has required fields', () => {
    exerciseModes.forEach(mode => {
      expect(mode).toHaveProperty('id');
      expect(mode).toHaveProperty('label');
      expect(mode).toHaveProperty('description');
      expect(mode).toHaveProperty('example');
      expect(mode).toHaveProperty('colorVar');
      expect(mode).toHaveProperty('icon');
      expect(mode).toHaveProperty('to');
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.description.length).toBeGreaterThan(0);
      expect(mode.example.length).toBeGreaterThan(0);
    });
  });
});

describe('conversationModes', () => {
  it('has exactly 3 conversation modes in the correct order', () => {
    expect(conversationModes.map(m => m.id)).toEqual([
      'simulation',
      'interview',
      'visual',
    ]);
  });

  it('interview is marked as highlighted', () => {
    const interview = conversationModes.find(m => m.id === 'interview');
    expect(interview?.highlighted).toBe(true);
  });

  it('only interview is highlighted', () => {
    const highlighted = conversationModes.filter(m => m.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].id).toBe('interview');
  });
});

describe('allModes', () => {
  it('contains all 7 modes', () => {
    expect(allModes).toHaveLength(7);
  });

  it('has no duplicate ids', () => {
    const ids = allModes.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/modes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/config/modes.ts`**

```typescript
import {
  MessageSquare,
  FileText,
  Theater,
  PenTool,
  Mic,
  Briefcase,
  Image,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface PracticeMode {
  id: string;
  label: string;
  description: string;
  example: string;
  colorVar: string;
  icon: LucideIcon;
  to: string;
  highlighted?: boolean;
}

export const exerciseModes: readonly PracticeMode[] = [
  {
    id: 'phrases',
    label: 'Frases',
    description: 'Traduza e pratique frases do dia a dia',
    example: 'Traduza "I\'d like to order coffee, please"',
    colorVar: 'phrases',
    icon: MessageSquare,
    to: '/exercises?mode=phrases',
  },
  {
    id: 'texts',
    label: 'Textos',
    description: 'Leia um texto e responda perguntas sobre ele',
    example: 'Leia um artigo sobre viagens e responda 5 perguntas',
    colorVar: 'texts',
    icon: FileText,
    to: '/exercises?mode=texts',
  },
  {
    id: 'situations',
    label: 'Situações',
    description: 'Responda a um cenário real em inglês',
    example: 'Você está num restaurante. Como pede a conta?',
    colorVar: 'situations',
    icon: Theater,
    to: '/exercises?mode=situations',
  },
  {
    id: 'scripts',
    label: 'Scripts',
    description: 'Receba um contexto e escreva um texto completo',
    example: 'Escreva um email formal para um cliente',
    colorVar: 'scripts',
    icon: PenTool,
    to: '/scripts',
  },
] as const;

export const conversationModes: readonly PracticeMode[] = [
  {
    id: 'simulation',
    label: 'Simulação ao Vivo',
    description: 'Converse em tempo real com a IA por voz',
    example: 'Simule uma conversa num café em Londres',
    colorVar: 'simulation',
    icon: Mic,
    to: '/live',
  },
  {
    id: 'interview',
    label: 'Entrevista',
    description: 'Pratique entrevistas de emprego em inglês',
    example: 'Responda "Tell me about yourself" como num interview real',
    colorVar: 'interview',
    icon: Briefcase,
    to: '/live?scenario=interview',
    highlighted: true,
  },
  {
    id: 'visual',
    label: 'Desafio Visual',
    description: 'Veja uma imagem e descreva o que acontece',
    example: 'Descreva a cena de uma foto de mercado',
    colorVar: 'visual',
    icon: Image,
    to: '/exercises?mode=visual',
  },
] as const;

export const allModes: readonly PracticeMode[] = [
  ...exerciseModes,
  ...conversationModes,
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/modes.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/modes.ts src/config/modes.test.ts
git commit -m "feat: add centralized mode configuration with colors and descriptions"
```

---

## Task 3: Create ModeCard Component

**Files:**
- Create: `src/components/shared/ModeCard.tsx`

- [ ] **Step 1: Create `src/components/shared/ModeCard.tsx`**

```typescript
import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { PracticeMode } from '../../config/modes';

interface ModeCardProps {
  mode: PracticeMode;
  onClick?: () => void;
  className?: string;
}

export function ModeCard({ mode, onClick, className }: ModeCardProps) {
  const Icon = mode.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 rounded-xl p-4 text-left cursor-pointer transition-all duration-200',
        'border-l-4 bg-card hover:scale-[1.01] hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      style={{
        borderLeftColor: `hsl(var(--mode-${mode.colorVar}))`,
        background: `linear-gradient(90deg, hsl(var(--mode-${mode.colorVar}-soft)) 0%, transparent 100%)`,
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `hsl(var(--mode-${mode.colorVar}-soft))`,
        }}
      >
        <Icon
          className="w-5 h-5"
          style={{ color: `hsl(var(--mode-${mode.colorVar}))` }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="font-semibold text-sm"
            style={{ color: `hsl(var(--mode-${mode.colorVar}))` }}
          >
            {mode.label}
          </span>
          {mode.highlighted && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `hsl(var(--mode-${mode.colorVar}))`,
                color: 'white',
              }}
            >
              ★ POPULAR
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {mode.description}
        </p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-muted-foreground flex-shrink-0"
      />
    </button>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/ModeCard.tsx
git commit -m "feat: add ModeCard component with colored sidebar style"
```

---

## Task 4: Create ModeTooltip Component

**Files:**
- Create: `src/components/ui/Tooltip.tsx`
- Create: `src/components/shared/ModeTooltip.tsx`

- [ ] **Step 1: Install Radix Tooltip**

Run: `npm install @radix-ui/react-tooltip`

- [ ] **Step 2: Create base Tooltip UI component `src/components/ui/Tooltip.tsx`**

```typescript
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../utils/cn';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          'z-50 overflow-hidden rounded-lg bg-popover border border-border px-3 py-2.5 text-sm shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          className,
        )}
        sideOffset={8}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
```

- [ ] **Step 3: Create `src/components/shared/ModeTooltip.tsx`**

```typescript
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '../ui/Tooltip';
import type { PracticeMode } from '../../config/modes';

interface ModeTooltipProps {
  mode: PracticeMode;
  children: React.ReactNode;
}

export function ModeTooltip({ mode, children }: ModeTooltipProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          style={{
            borderLeftColor: `hsl(var(--mode-${mode.colorVar}))`,
            borderLeftWidth: '3px',
          }}
        >
          <p className="font-semibold text-foreground text-sm">{mode.label}</p>
          <p className="text-muted-foreground text-xs mt-1">{mode.description}</p>
          <p className="text-xs mt-1.5 italic" style={{ color: `hsl(var(--mode-${mode.colorVar}))` }}>
            Ex: {mode.example}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: Verify the app compiles**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Tooltip.tsx src/components/shared/ModeTooltip.tsx package.json package-lock.json
git commit -m "feat: add Tooltip component and ModeTooltip with explanation + example"
```

---

## Task 5: Update Navigation Config (6 Items)

**Files:**
- Modify: `src/config/navigation.ts`
- Modify: `src/config/navigation.test.ts`

- [ ] **Step 1: Update the test `src/config/navigation.test.ts`**

Replace the full file content:

```typescript
import { describe, expect, it } from 'vitest';
import { primaryNavItems } from './navigation';

describe('primaryNavItems', () => {
  it('contains the six approved top-level destinations', () => {
    expect(primaryNavItems.map(item => item.to)).toEqual([
      '/',
      '/practice',
      '/library',
      '/review',
      '/errors',
      '/settings',
    ]);
  });

  it('includes /practice and /errors as top-level nav items', () => {
    expect(primaryNavItems.some(item => item.to === '/practice')).toBe(true);
    expect(primaryNavItems.some(item => item.to === '/errors')).toBe(true);
  });

  it('excludes /paths, /scripts, /live, /history as top-level nav items', () => {
    expect(primaryNavItems.some(item => item.to === '/paths')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/scripts')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/live')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/history')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/navigation.test.ts`
Expected: FAIL — nav items don't match the new expected list.

- [ ] **Step 3: Update `src/config/navigation.ts`**

Replace the full file content:

```typescript
import {
  Compass,
  Sparkles,
  BookOpen,
  RotateCcw,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const primaryNavItems: readonly NavItem[] = [
  { to: '/', label: 'Início', icon: Compass },
  { to: '/practice', label: 'Praticar', icon: Sparkles },
  { to: '/library', label: 'Biblioteca', icon: BookOpen },
  { to: '/review', label: 'Revisão', icon: RotateCcw },
  { to: '/errors', label: 'Erros', icon: AlertTriangle },
  { to: '/settings', label: 'Configurações', icon: Settings },
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/navigation.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/navigation.ts src/config/navigation.test.ts
git commit -m "feat: update navigation to 6 sidebar items with Erros"
```

---

## Task 6: Update Practice Config

**Files:**
- Modify: `src/config/practice.ts`
- Modify: `src/config/practice.test.ts`

- [ ] **Step 1: Update the test `src/config/practice.test.ts`**

Replace the full file content:

```typescript
import { describe, expect, it } from 'vitest';
import { exerciseSetupSteps, liveSetupScenarios } from './practice';

describe('exerciseSetupSteps', () => {
  it('keeps the agreed setup order', () => {
    expect(exerciseSetupSteps).toEqual(['format', 'type', 'theme', 'generate']);
  });
});

describe('liveSetupScenarios', () => {
  it('includes everyday and interview scenarios', () => {
    expect(liveSetupScenarios.map(s => s.id)).toEqual(['everyday', 'interview']);
  });

  it('interview scenario is highlighted', () => {
    const interview = liveSetupScenarios.find(s => s.id === 'interview');
    expect(interview?.highlighted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/practice.test.ts`
Expected: FAIL — `liveSetupScenarios` doesn't exist yet.

- [ ] **Step 3: Update `src/config/practice.ts`**

Replace the full file content:

```typescript
export const exerciseSetupSteps = ['format', 'type', 'theme', 'generate'] as const;

export const liveSetupScenarios = [
  { id: 'everyday', title: 'Day-to-day scenarios', highlighted: false },
  { id: 'interview', title: 'Interview and professional', highlighted: true },
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/practice.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/practice.ts src/config/practice.test.ts
git commit -m "refactor: simplify practice config, remove old primary/secondary split"
```

---

## Task 7: Rebuild PracticeHubPage

**Files:**
- Modify: `src/components/practice/PracticeHubPage.tsx`

- [ ] **Step 1: Rewrite `src/components/practice/PracticeHubPage.tsx`**

Replace the full file content:

```typescript
import { useNavigate } from 'react-router-dom';
import { exerciseModes, conversationModes } from '../../config/modes';
import { ModeCard } from '../shared/ModeCard';
import { ModeTooltip } from '../shared/ModeTooltip';

export function PracticeHubPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Praticar</h1>
        <p className="text-muted-foreground mt-1">
          Escolha como quer praticar hoje
        </p>
      </div>

      {/* Exercícios Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: 'hsl(var(--mode-phrases))' }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Exercícios
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {exerciseModes.map((mode) => (
            <ModeTooltip key={mode.id} mode={mode}>
              <div>
                <ModeCard
                  mode={mode}
                  onClick={() => navigate(mode.to)}
                />
              </div>
            </ModeTooltip>
          ))}
        </div>
      </section>

      {/* Conversação Section */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: 'hsl(var(--mode-simulation))' }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conversação
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {conversationModes.map((mode) => (
            <ModeTooltip key={mode.id} mode={mode}>
              <div>
                <ModeCard
                  mode={mode}
                  onClick={() => navigate(mode.to)}
                />
              </div>
            </ModeTooltip>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Visual verification**

Run: `npx vite --port 5173 --host`

Open browser at the practice page. Verify:
- Two sections visible: "Exercícios" (4 cards) and "Conversação" (3 cards)
- Each card has colored left border matching its mode
- Cards have gradient backgrounds
- "Entrevista" card shows "★ POPULAR" badge
- Hovering a card shows tooltip with explanation and example

- [ ] **Step 4: Commit**

```bash
git add src/components/practice/PracticeHubPage.tsx
git commit -m "feat: rebuild Practice Hub with two-section layout and mode cards"
```

---

## Task 8: Update Sidebar and Mobile Navigation

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Navigation.tsx`

These components already import `primaryNavItems` from the config, so they pick up the new 6 items automatically. However, the Sidebar may need spacing adjustments for 6 items instead of 5.

- [ ] **Step 1: Check that Sidebar renders correctly with 6 items**

Run: `npx vite --port 5173 --host`

Open browser, verify sidebar shows 6 items: Início, Praticar, Biblioteca, Revisão, Erros, Configurações.

- [ ] **Step 2: Check mobile navigation renders 6 items**

Verify the bottom navigation bar on mobile (narrow viewport) shows all 6 items without overflow or layout issues.

If the mobile nav has layout issues with 6 items, adjust `Navigation.tsx` — change `min-w-[3rem]` to `min-w-[2.5rem]` and reduce `px-2` to `px-1.5`.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 4: Commit (if changes were needed)**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Navigation.tsx
git commit -m "fix: adjust navigation spacing for 6 sidebar items"
```

(If no changes were needed, skip this commit.)

---

## Task 9: Update Routes in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update `src/App.tsx`**

The routes file currently has separate routes for `/paths`, `/scripts`, `/history`, and `/live`. These pages still need to exist (they're linked from the Practice Hub), so we keep them. No routes are removed yet — only the navigation structure changed.

However, clean up the import of `HistoryPage` if it's no longer directly navigable from the sidebar. All routes stay for now.

No code changes needed in this step — routes remain as-is. The sidebar just doesn't link to them directly anymore.

- [ ] **Step 2: Verify app still works**

Run: `npx vite --port 5173 --host`

Navigate through the app:
- `/practice` shows new hub
- Clicking each mode card navigates correctly
- `/errors` shows error dashboard
- `/library`, `/review`, `/settings` still work

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

---

## Task 10: Fix ImageMode Bug (Desafio Visual)

**Files:**
- Modify: `src/components/discovery/ImageMode.tsx`

- [ ] **Step 1: Investigate the bug**

Run: `npx vite --port 5173 --host`

Navigate to the visual challenge. Observe what renders (blank screen, error, etc.). Check browser console for errors.

- [ ] **Step 2: Read `src/components/discovery/ImageMode.tsx` and diagnose the issue**

Common causes for blank render in this codebase:
- Missing data from API/state
- Conditional rendering that hides everything when data is missing
- Broken image URL or loading state

Fix the specific issue found. This step requires runtime investigation — the fix depends on what's actually broken.

- [ ] **Step 3: Apply the fix**

Edit `src/components/discovery/ImageMode.tsx` to fix the rendering issue.

- [ ] **Step 4: Verify the fix**

Navigate to Desafio Visual via the Practice Hub. Confirm the image loads and the exercise flow works.

- [ ] **Step 5: Commit**

```bash
git add src/components/discovery/ImageMode.tsx
git commit -m "fix: resolve Desafio Visual blank screen rendering issue"
```

---

## Task 11: Run Full Test Suite and Visual QA

**Files:**
- None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Full visual QA walkthrough**

Open the app and verify every page:

1. **Sidebar** — 6 items, correct icons and labels, active state works
2. **Mobile nav** — 6 items visible, no overflow
3. **Practice Hub** — Two sections, colored cards, tooltips on hover, badge on Entrevista
4. **Exercícios** — Still works when navigated from hub
5. **Simulação Ao Vivo** — Still works, setup flow intact
6. **Biblioteca** — Works, search works
7. **Revisão** — Works
8. **Erros** — Works as standalone page from sidebar
9. **Configurações** — Works
10. **Desafio Visual** — No longer blank

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final QA adjustments for UI redesign"
```
