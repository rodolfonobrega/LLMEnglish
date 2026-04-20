import { MicrophoneButton } from '../ui/custom/MicrophoneButton';
import { Card } from '../ui/card';
import { cn } from '../../utils/cn';

interface MicPanelProps {
  isConnected: boolean;
  isMicActive: boolean;
  onToggleMic: () => void;
}

export function MicPanel({ isConnected, isMicActive, onToggleMic }: MicPanelProps) {
  return (
    <Card className="p-6 mx-4 sm:mx-0 shadow-sm border-slate-100">
      <div className="flex flex-col items-center gap-4">
        <MicrophoneButton
          onClick={onToggleMic}
          isRecording={isMicActive}
          disabled={!isConnected}
          size="lg"
        />
        <p className={cn(
          'text-sm font-semibold transition-colors',
          isMicActive ? 'text-blue-600' : 'text-muted-foreground'
        )}>
          {!isConnected ? 'Conectando...' : isMicActive ? 'Ouvindo...' : 'Toque para Falar'}
        </p>
      </div>
    </Card>
  );
}
