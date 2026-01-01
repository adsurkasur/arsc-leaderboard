'use client';

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Enhanced Toaster with polished animations
 * - Positioned bottom-right on desktop, bottom-center on mobile
 * - Rich visual styling with shadows and borders
 * - Smooth entrance/exit animations
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      expand={true}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          closeButton: "group-[.toast]:bg-background group-[.toast]:border-border group-[.toast]:text-foreground",
          success: "group-[.toaster]:border-success/30 group-[.toaster]:bg-success/10",
          error: "group-[.toaster]:border-destructive/30 group-[.toaster]:bg-destructive/10",
          warning: "group-[.toaster]:border-warning/30 group-[.toaster]:bg-warning/10",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
