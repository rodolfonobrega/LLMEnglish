import { useRouteError, useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

function isChunkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.name === 'ChunkLoadError' ||
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    );
  }
  return false;
}

export function ErrorFallback() {
  const error = useRouteError();
  const navigate = useNavigate();
  const message = error instanceof Error ? error.message : 'Algo deu errado';

  console.error('[RouteErrorBoundary]', error);

  const handleRetry = () => {
    if (isChunkError(error)) {
      // Soft retry: re-navigate to trigger chunk re-fetch without full page reload
      navigate(0);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <div className="size-16 bg-[var(--danger-soft)] rounded-full flex items-center justify-center">
        <AlertTriangle className="text-danger" size={32} />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-foreground">Algo deu errado</h3>
        <p className="text-muted-foreground max-w-sm">{message}</p>
      </div>
      <Button variant="primary" onClick={handleRetry} className="gap-2 cursor-pointer">
        <RefreshCw size={16} />
        Tentar novamente
      </Button>
      <p className="text-xs text-muted-foreground">
        Use a barra lateral para navegar para outra pagina
      </p>
    </div>
  );
}
