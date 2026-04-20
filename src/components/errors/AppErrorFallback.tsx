import { AlertTriangle, RefreshCw } from 'lucide-react';

export function AppErrorFallback({ error }: {
  error: unknown;
  resetErrorBoundary: () => void;
}) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[AppErrorBoundary]', error);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="size-16 bg-[var(--danger-soft)] rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="text-danger" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Erro inesperado</h2>
        <p className="text-muted-foreground">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/80 cursor-pointer"
        >
          <RefreshCw size={16} />
          Recarregar pagina
        </button>
      </div>
    </div>
  );
}
