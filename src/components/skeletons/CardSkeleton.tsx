import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface CardSkeletonProps {
  showHeader?: boolean;
  showDescription?: boolean;
  lines?: number;
}

const CardSkeleton = ({ showHeader = true, showDescription = false, lines = 2 }: CardSkeletonProps) => {
  return (
    <Card className="animate-pulse">
      {showHeader && (
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
          {showDescription && <Skeleton className="h-3 w-32 mt-1" />}
        </CardHeader>
      )}
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i === 0 ? "w-3/4" : "w-1/2"}`} />
        ))}
      </CardContent>
    </Card>
  );
};

export default CardSkeleton;
