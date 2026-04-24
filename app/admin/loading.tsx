import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
      <div className="grid min-h-screen gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Skeleton className="hidden h-full rounded-[32px] lg:block" />
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-[32px]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full rounded-[32px]" />
            ))}
          </div>
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,1fr)]">
            <Skeleton className="h-[440px] w-full rounded-[32px]" />
            <Skeleton className="h-[440px] w-full rounded-[32px]" />
          </div>
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)]">
            <Skeleton className="h-[420px] w-full rounded-[32px]" />
            <Skeleton className="h-[420px] w-full rounded-[32px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
