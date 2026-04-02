import { useRouteError } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

export function ErrorFallback() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'Algo deu errado';

  console.error('[RouteErrorBoundary]', error);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <div className="size-16 bg-[var(--danger-soft)] rounded-full flex items-center justify-center">
        <AlertTriangle className="text-danger" size={32} />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-foreground">Algo deu errado</h3>
        <p className="text-muted-foreground max-w-sm">{message}</p>
      </div>
      <Button variant="primary" onClick={() => window.location.reload()} className="gap-2 cursor-pointer">
        <RefreshCw size={16} />
        Tentar novamente
      </Button>
      <p className="text-xs text-muted-foreground">
        Use a barra lateral para navegar para outra pagina
      </p>
    </div>
  );
}
