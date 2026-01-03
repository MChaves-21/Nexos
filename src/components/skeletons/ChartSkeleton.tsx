import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface ChartSkeletonProps {
  height?: number;
}

const ChartSkeleton = ({ height = 300 }: ChartSkeletonProps) => {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2" style={{ height }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="flex-1 rounded-t" 
              style={{ height: `${30 + Math.random() * 60}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-8" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChartSkeleton;
