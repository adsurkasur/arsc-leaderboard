'use client';

import { cn } from "@/lib/utils";

/**
 * Skeleton component with shimmer animation
 * Used for loading placeholders with a subtle shine effect
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted",
        // Shimmer animation
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:animate-[shimmer_2s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
        className
      )} 
      {...props} 
    />
  );
}

export { Skeleton };
