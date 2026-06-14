export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Page title skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-64 bg-[var(--bg-tertiary)] rounded-lg" />
        <div className="h-10 w-32 bg-[var(--bg-tertiary)] rounded-lg" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)]" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-80 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)]" />
        <div className="h-80 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)]" />
      </div>

      {/* Bottom section skeleton */}
      <div className="h-48 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)]" />
    </div>
  )
}
