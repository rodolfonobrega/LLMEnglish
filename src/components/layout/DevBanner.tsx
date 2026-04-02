/**
 * Dev Mode Banner
 *
 * Shows a subtle banner indicating dev mode when Supabase is not configured.
 * Only visible when running in dev mode without VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.
 */
export function DevBanner() {
  if (!import.meta.env.DEV) return null
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) return null

  return (
    <div className="bg-amber-soft text-amber text-center text-xs py-1.5 px-4 font-medium">
      Dev mode -- some features unavailable (no Supabase connection)
    </div>
  )
}
