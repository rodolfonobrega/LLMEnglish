import { LogOut } from 'lucide-react';

export interface AppearanceSectionProps {
  onLogout: () => void;
}

/**
 * Appearance / session controls. Currently only exposes a sign-out button that
 * the orchestrator renders inside the header so the existing layout is preserved.
 */
export function SignOutButton({ onLogout }: AppearanceSectionProps) {
  return (
    <button
      onClick={onLogout}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
    >
      <LogOut size={16} />
      <span className="hidden sm:inline">Sair</span>
    </button>
  );
}
