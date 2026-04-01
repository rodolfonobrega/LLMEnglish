# Coding Conventions

**Analysis Date:** 2026-04-01

## Naming Patterns

**Files:**
- PascalCase for React components: `Button.tsx`, `ModeCard.tsx`, `PracticeHubPage.tsx`
- camelCase for utility/service modules: `openai.ts`, `storage.ts`, `cn.ts`
- camelCase for hooks: `useLocalStorage.ts`, `useTheme.ts`, `useTTS.ts`
- camelCase for types: `settings.ts`, `gamification.ts`, `supabase.ts`
- Test files mirror source with `.test.ts` suffix: `openai.test.ts`, `modes.test.ts`
- Test files are co-located with source (same directory)

**Functions:**
- camelCase for all functions: `getModelConfig()`, `chatCompletion()`, `blobToBase64()`
- Private/internal helper functions prefixed with lowercase provider name: `openaiChat()`, `geminiTTS()`, `groqSTT()`
- `export` only on public API functions; internal helpers are file-scoped (no `export`)
- Boolean getters use `get` prefix: `getOpenAIKey()`, `getGeminiKey()`

**Variables:**
- camelCase for all variables: `config`, `base64Audio`, `mediaRecorder`
- UPPER_SNAKE_CASE for constants: `OPENAI_BASE`, `GROQ_BASE`, `MAX_SESSION_REPORTS`
- `KEYS` object for localStorage key constants in `src/services/storage.ts`

**Types:**
- PascalCase for interfaces and types: `ModelConfig`, `PracticeMode`, `AudioRecorderState`
- Export types alongside their usage: `export type Provider = ...`
- `type` keyword preferred over `interface` for simple unions: `type Provider = 'openai' | 'gemini' | 'groq'`
- `interface` keyword for object shapes: `interface ButtonProps`, `interface AuthContextValue`
- Use `readonly` arrays for config data: `export const exerciseModes: readonly PracticeMode[]`

## Code Style

**Formatting:**
- No Prettier config file detected; formatting follows TypeScript/React community conventions
- 2-space indentation (consistent across all files)
- Single quotes for imports and strings
- Semicolons at end of statements
- Trailing commas in objects and arrays

**Linting:**
- ESLint 9 with flat config at `eslint.config.js`
- Extends: `js.configs.recommended`, `tseslint.configs.recommended`, `react-hooks`, `react-refresh`
- Key rules:
  - `react-refresh/only-export-components`: `['error', { allowConstantExport: true }]`
  - `react-hooks/set-state-in-effect`: `'off'`
  - `react-hooks/static-components`: `'off'`
  - `react-hooks/immutability`: `'off'`
- Global ignores: `dist`, `coverage`

**TypeScript Strictness:**
- `strict: true` enabled in `tsconfig.app.json`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedSideEffectImports: true`
- `verbatimModuleSyntax: true` (requires `import type` for type-only imports)
- `erasableSyntaxOnly: true`
- Target: ES2022 with bundler module resolution

## Import Organization

**Order:**
1. React imports: `import { useState, useCallback } from 'react'`
2. Third-party packages: `import { useNavigate } from 'react-router-dom'`
3. Internal modules (relative paths with `../` prefix for cross-directory):
   `import { cn } from '../../utils/cn'`
4. Types (use `import type` syntax):
   `import type { PracticeMode } from '../../config/modes'`

**Pattern:**
- Use `import type` for type-only imports (required by `verbatimModuleSyntax`):
  `import type { ModelConfig } from '../types/settings'`
- Destructure named imports (no wildcard imports)
- No path aliases configured; all imports use relative paths

## Component Patterns

**Function Components Only:**
- All components are function components with named exports
- No class components anywhere in the codebase
- Export pattern: `export function ComponentName()` (named export, not default)
- Exception: `App.tsx` uses `export default App`

**Component File Structure:**
```tsx
// 1. Imports
import { useState } from 'react';
import { cn } from '../../utils/cn';
import type { PracticeMode } from '../../config/modes';

// 2. Interface for props
interface ModeCardProps {
  mode: PracticeMode;
  onClick?: () => void;
  className?: string;
}

// 3. Component definition
export function ModeCard({ mode, onClick, className }: ModeCardProps) {
  // hooks at top
  const [imgError, setImgError] = useState(false);
  // ...
  return (/* JSX */);
}
```

**UI Components (shadcn-style):**
- Located in `src/components/ui/`
- Use `React.forwardRef` pattern: `const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...)`
- Set `displayName`: `Button.displayName = "Button"`
- Use `class-variance-authority` (cva) for variant styling
- Use `cn()` utility (clsx + twMerge) for class composition
- Legacy variant mapping pattern for backward compatibility (see `src/components/ui/Button.tsx`)

**Page Components:**
- Located in feature directories: `src/components/practice/PracticeHubPage.tsx`
- Named export, no props (pages get data from hooks/context)
- Use `useNavigate()` for navigation

## State Patterns

**Local State:**
- `useState` for component-local state
- `useRef` for mutable refs (MediaRecorder, DOM elements)
- State objects use interfaces: `AudioRecorderState`, `AuthContextValue`

**Custom Hooks:**
- Located in `src/hooks/`
- Prefix with `use`: `useLocalStorage`, `useTheme`, `useTTS`, `useAudioRecorder`
- Return destructurable objects: `return { speak, isLoading, error, stopAudio }`
- Use `useCallback` for memoized functions passed as return values

**Global State:**
- React Context via `src/contexts/AuthContext.tsx` for auth
- Runtime state module pattern in `src/services/runtimeState.ts`:
  - Module-level `let state` variable
  - Getter/setter functions
  - `window.dispatchEvent` for change notification
  - `hydrateRuntimeState()` for async initialization from Supabase
- localStorage for persistence (wrapped in `src/services/storage.ts`)

**Context Pattern:**
```tsx
// Create with undefined default
const Context = createContext<ContextValue | undefined>(undefined)

// Custom hook with guard
export function useContext() {
  const context = useContext(Context)
  if (!context) throw new Error('useX must be used within XProvider')
  return context
}
```

## Error Handling

**Patterns:**
- Throw `Error` with descriptive messages for API failures: `throw new Error('OpenAI API key not configured. Go to Settings to add it.')`
- Provider fallback pattern: try primary, catch and try fallback, then re-throw if both fail
- `console.warn` for fallback triggers: `console.warn('Primary chat failed, trying fallback:', primaryError)`
- `console.error` for logged errors: `console.error('Failed to load session:', error)`
- `try/catch` with empty catch blocks for non-critical storage operations
- Error state in hooks: `const [error, setError] = useState<string | null>(null)`

**Error Boundaries:**
- `src/components/errors/ErrorDashboard.tsx` exists as a dedicated page
- No React Error Boundary component detected (errors handled at page/component level)

**API Error Pattern:**
```typescript
if (!resp.ok) {
  const err = await resp.text();
  throw new Error(`OpenAI API error: ${resp.status} - ${err}`);
}
```

## Styling Conventions

**CSS Framework:**
- Tailwind CSS v4 (imported via `@tailwindcss/vite` plugin)
- Custom CSS variables defined in `src/index.css` using `@layer base` and `@theme`

**Color System:**
- HSL variables for all colors: `--background: 210 33% 97%`
- Light and dark mode variants via `.dark` class
- Semantic color names: `--brand-primary`, `--brand-special`, `--danger`
- Mode-specific color tokens: `--mode-phrases`, `--mode-texts`, `--mode-situations`, etc.
- Each mode has a `-soft` variant for backgrounds: `--mode-phrases-soft`

**Tailwind Class Patterns:**
- Use semantic color classes via `@theme` mapping: `text-foreground`, `bg-card`, `text-muted-foreground`
- Compose classes with `cn()` utility: `cn('base-classes', className)`
- Group related classes with comments: `{/* Sidebar - Desktop Only */}`
- Responsive: `hidden lg:block` for desktop-only, `lg:hidden` for mobile-only
- Breakpoint used: `lg` (1024px) for sidebar/mobile-nav toggle

**Custom CSS Classes (in `src/index.css`):**
- `.glass` - frosted glass effect with backdrop blur
- `.gradient-text` - brand gradient text
- `.card-hover` - lift effect on hover
- `.speech-bubble` - chat bubble with arrow
- `.scrollbar-hide` - hide scrollbar
- `.animate-*` - custom animations (float, pulse-glow, wave, message-in, progress-indeterminate)

**CSS Variable Usage in JS:**
- Access via inline styles: `style={{ borderLeftColor: 'hsl(var(--mode-phrases))' }}`
- Never hardcode colors in component files

## Git Conventions

**Commit Message Format:**
- Conventional Commits style: `type: description`
- Types observed: `feat`, `fix`
- Examples:
  - `feat: update image generation script and regenerate all images in cohesive style`
  - `fix: resolve Desafio Visual blank screen rendering issue`
  - `feat: complete visual redesign - teal/navy Busbu-style palette`
  - `fix: remove English from exercise tips - prompts must be Portuguese-only`

**Branch:**
- Single `main` branch for development
- No feature branch pattern detected in recent history

## Configuration Files

**TypeScript:**
- `tsconfig.json` - project references to app and node configs
- `tsconfig.app.json` - app source config (`src/` include, strict mode, ES2022)
- `tsconfig.node.json` - Node/tooling config

**ESLint:**
- `eslint.config.js` - flat config with TypeScript, React hooks, React refresh plugins

**Build:**
- `vite.config.ts` - Vite 6 with React, Tailwind CSS plugins, test config, Groq proxy
- No separate Tailwind config file (Tailwind v4 uses CSS-based config)

**Environment:**
- `.env` - base env vars (exists, do not read)
- `.env.local` - local overrides (exists, do not read)
- `.env.example` and `.env.local.example` - template files
- Vite env vars use `VITE_` prefix: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_GROQ_API_KEY`

**Other:**
- `.gitignore` - standard Node ignores plus `.env`, `.env.local`, `coverage/`
- `Dockerfile` - production container config
- `nginx.conf` - production server config
- `Makefile` - build/dev commands
- `CLAUDE.md` - Claude Code instructions
- `AGENTS.md` - agent instructions

## Environment Setup

**Prerequisites:**
- Node.js (version managed by `.nvmrc` or similar)
- npm (lockfile: `package-lock.json` present)

**Development:**
```bash
npm install              # Install dependencies
npx vite --port 5173 --host   # Start dev server
```

**Key Notes:**
- Port 5173 is required (Supabase redirect URLs configured for this port)
- `--host` flag needed in devcontainers
- Dev mode (`vite`) skips auth if no Supabase env vars -- UI renders directly
- Supabase is remote; no Docker needed for local development

**Build:**
```bash
npm run build            # tsc -b && vite build
npm run preview          # Preview production build
```

**Lint:**
```bash
npm run lint             # ESLint check
```

## Module Design

**Exports:**
- Named exports preferred: `export function ...`, `export const ...`
- Default export only for `App` in `src/App.tsx`
- No barrel files (index.ts re-exports) in component directories
- `src/services/supabase/index.ts` is the only barrel file detected

**Service Pattern:**
- Services in `src/services/` export functions, not classes (except live sessions)
- Live session classes (`GeminiLiveSession`, `OpenAIRealtimeLiveSession`) use constructor + method pattern
- Storage layer abstracts localStorage: `src/services/storage.ts`
- Runtime state module: `src/services/runtimeState.ts` (in-memory + Supabase hydration)

---

*Convention analysis: 2026-04-01*
