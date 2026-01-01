'use client';

import * as React from "react";
import { m, HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";
import { fadeInUp, cardHover, smoothSpring } from "@/lib/motion";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-xl border bg-card text-card-foreground shadow-card", className)} {...props} />
));
Card.displayName = "Card";

/**
 * MotionCard - An animated card with entrance animation and hover lift effect
 * 
 * Usage:
 * <MotionCard>Content here</MotionCard>
 * <MotionCard disableHover>Without hover effect</MotionCard>
 */
interface MotionCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  disableHover?: boolean;
}

const MotionCard = React.forwardRef<HTMLDivElement, MotionCardProps>(
  ({ className, disableHover = false, ...props }, ref) => (
    <m.div
      ref={ref}
      className={cn("rounded-xl border bg-card text-card-foreground shadow-card", className)}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      whileHover={disableHover ? undefined : cardHover}
      transition={smoothSpring}
      {...props}
    />
  )
);
MotionCard.displayName = "MotionCard";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5 md:p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl md:text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5 md:p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 md:p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, MotionCard, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
