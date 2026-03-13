import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-white/5', className)}
      aria-hidden="true"
    />
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-12 rounded-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-2 w-full rounded-full mt-4" />
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

export function DashboardStatSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-2">
      <Skeleton className="h-6 w-6 rounded-lg" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}
