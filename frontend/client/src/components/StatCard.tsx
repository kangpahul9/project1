import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
  iconColor?: string;
  iconBg?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  iconColor,
  iconBg,
}: StatCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600"
      : trend === "down"
      ? "text-red-500"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "bg-card border border-card-border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow duration-200",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            iconBg ?? "bg-primary/10"
          )}
        >
          <Icon className={cn("w-5 h-5", iconColor ?? "text-primary")} />
        </div>
        {trend && (
          <TrendIcon className={cn("w-4 h-4 mt-0.5", trendColor)} />
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
}
