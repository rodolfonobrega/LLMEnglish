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
