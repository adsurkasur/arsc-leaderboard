'use client';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useState } from "react";
import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";

/**
 * Application Providers
 * 
 * Wraps the app with all necessary context providers:
 * - QueryClient: TanStack Query for data fetching
 * - AuthProvider: Authentication state
 * - TooltipProvider: Radix tooltip context
 * - LazyMotion: Framer Motion with lazy-loaded features (reduces bundle size)
 * - MotionConfig: Global motion settings with reduced-motion support
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          {/* LazyMotion loads animation features on-demand for better performance */}
          <LazyMotion features={domAnimation} strict>
            {/* MotionConfig applies global settings - reducedMotion respects user preference */}
            <MotionConfig reducedMotion="user">
              <Toaster />
              <Sonner />
              {children}
            </MotionConfig>
          </LazyMotion>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
