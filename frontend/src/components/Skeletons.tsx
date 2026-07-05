import { Skeleton } from '@/components/ui/skeleton'

/** Loading skeletons for the dashboard and reports screens. */

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center justify-between px-1 pt-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-9 w-16 rounded-full" />
      </div>
      <div className="rounded-2xl border p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="size-28 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  )
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading report">
      <div className="rounded-2xl border p-5">
        <Skeleton className="mb-3 h-5 w-1/2" />
        <Skeleton className="h-44 w-full" />
      </div>
      <div className="rounded-2xl border p-5">
        <Skeleton className="mb-3 h-5 w-1/3" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  )
}

export function InsightSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Generating insight">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}
