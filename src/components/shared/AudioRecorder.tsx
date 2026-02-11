import { Mic, Square, Trash2, Play, Pause, Send } from 'lucide-react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useState, useRef } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface AudioRecorderProps {
  onAudioReady: (blob: Blob, base64: string) => void;
  disabled?: boolean;
}

export function AudioRecorder({ onAudioReady, disabled }: AudioRecorderProps) {
  const { isRecording, audioBlob, audioUrl, audioBase64, startRecording, stopRecording, discardRecording, error } = useAudioRecorder();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayback = () => {
    if (!audioUrl) return;
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSubmit = () => {
    if (audioBlob && audioBase64) onAudioReady(audioBlob, audioBase64);
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border">
      {error && (
        <p className="text-[var(--danger)] text-sm text-center mb-3">{error}</p>
      )}

      <div className="flex flex-col items-center gap-4">
        {/* Record button */}
        {!isRecording && !audioBlob && (
          <>
            <div className="relative">
              <button
                onClick={startRecording}
                disabled={disabled}
                aria-label="Start recording"
                className={cn(
                  'size-16 rounded-full flex items-center justify-center transition-colors duration-200 cursor-pointer',
                  'bg-[var(--coral)] text-white',
                  'hover:bg-[var(--coral-hover)] active:scale-95',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--coral)]/40',
                )}
              >
                <Mic size={28} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Tap to Record</p>
          </>
        )}

        {/* Recording active */}
        {isRecording && (
          <>
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-[var(--coral)]/15 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute -inset-2 rounded-full border-2 border-[var(--coral)]/30 animate-pulse" />
              <button
                onClick={stopRecording}
                aria-label="Stop recording"
                className="relative size-16 rounded-full flex items-center justify-center bg-[var(--coral)] text-white cursor-pointer"
              >
                <Square size={24} />
              </button>
            </div>
            <div className="flex items-center gap-2 text-[var(--coral)] text-sm font-semibold">
              <div className="size-2 bg-[var(--coral)] rounded-full animate-pulse" />
              Recording...
            </div>
          </>
        )}

        {/* Playback controls */}
        {audioBlob && !isRecording && (
          <div className="flex items-center gap-3 w-full justify-center">
            <Button
              variant="secondary"
              size="default"
              onClick={handlePlayback}
              aria-label={isPlaying ? 'Pause playback' : 'Play recording'}
              className="rounded-full cursor-pointer"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              {isPlaying ? 'Pause' : 'Listen'}
            </Button>

            <Button
              variant="ghost"
              size="default"
              onClick={discardRecording}
              aria-label="Discard recording"
              className="rounded-full text-muted-foreground cursor-pointer"
            >
              <Trash2 size={18} />
            </Button>

            <Button
              variant="coral"
              size="default"
              onClick={handleSubmit}
              disabled={disabled}
              aria-label="Submit recording"
              className="rounded-full bg-[var(--leaf)] hover:bg-[var(--leaf)] cursor-pointer"
            >
              <Send size={18} />
              Submit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
