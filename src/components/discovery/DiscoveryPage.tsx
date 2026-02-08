import { ExerciseMode } from './ExerciseMode';

export function DiscoveryPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-ink text-balance">Discovery Lab</h2>
        <p className="text-ink-muted text-pretty max-w-md mx-auto">
          Design natural speech scenarios and practice speaking.
        </p>
      </div>

      <ExerciseMode />
    </div>
  );
}
