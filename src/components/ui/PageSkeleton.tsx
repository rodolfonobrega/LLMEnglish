export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 py-4" aria-hidden="true">
      {/* Title skeleton */}
      <div className="h-8 bg-secondary rounded-md w-1/3" />
      {/* Content block skeletons */}
      <div className="space-y-4">
        <div className="h-24 bg-secondary rounded-lg" />
        <div className="h-24 bg-secondary rounded-lg" />
        <div className="h-24 bg-secondary rounded-lg" />
      </div>
    </div>
  );
}
