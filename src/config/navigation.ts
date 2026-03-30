import {
  Compass,
  Sparkles,
  RotateCcw,
  BookOpen,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const primaryNavItems: readonly NavItem[] = [
  { to: '/', label: 'Inicio', icon: Compass },
  { to: '/practice', label: 'Praticar', icon: Sparkles },
  { to: '/review', label: 'Revisao', icon: RotateCcw },
  { to: '/library', label: 'Biblioteca', icon: BookOpen },
  { to: '/settings', label: 'Configuracoes', icon: Settings },
] as const;
