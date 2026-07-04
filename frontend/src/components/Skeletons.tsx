/** Loading skeletons for the dashboard and reports screens. */

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center gap-3">
        <div className="skeleton h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-5 w-2/3" />
          <div className="skeleton h-4 w-1/3" />
        </div>
        <div className="skeleton h-8 w-14 rounded-full" />
      </div>
      <div className="card space-y-3">
        <div className="skeleton h-5 w-1/2" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-full" />
      </div>
      <div className="card space-y-3">
        <div className="skeleton h-5 w-1/3" />
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-full" />
      </div>
    </div>
  )
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading report">
      <div className="card space-y-3">
        <div className="skeleton h-5 w-1/2" />
        <div className="skeleton h-44 w-full" />
      </div>
      <div className="card space-y-3">
        <div className="skeleton h-5 w-1/3" />
        <div className="skeleton h-28 w-full" />
      </div>
    </div>
  )
}

export function InsightSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Generating insight">
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-11/12" />
      <div className="skeleton h-4 w-4/5" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  )
}
