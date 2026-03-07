import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  variant?: "default" | "success" | "destructive";
}

const StatCard = ({ title, value, icon: Icon, trend, variant = "default" }: StatCardProps) => {
  const variantStyles = {
    default: "border-primary/20 hover:border-primary/40",
    success: "border-success/20 hover:border-success/40",
    destructive: "border-destructive/20 hover:border-destructive/40",
  };

  const iconBgStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className={cn("transition-all hover:shadow-lg", variantStyles[variant])}>
      <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate pr-2">
          {title}
        </CardTitle>
        <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", iconBgStyles[variant])}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
        <div className="text-lg sm:text-2xl font-bold truncate">{value}</div>
        {trend && (
          <p className={cn(
            "text-xs mt-0.5 sm:mt-1 truncate",
            trend.positive ? "text-success" : "text-destructive"
          )}>
            {trend.positive ? "+" : ""}{trend.value} vs anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
