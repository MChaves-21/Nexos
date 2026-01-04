import { Skeleton } from "@/components/ui/skeleton";

const TransactionRowSkeleton = () => (
  <div className="flex items-center justify-between p-3 rounded-lg border">
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
    <div className="flex items-center gap-4">
      <Skeleton className="h-5 w-24" />
      <div className="flex gap-1">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  </div>
);

export default TransactionRowSkeleton;
