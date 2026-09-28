import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/base-path";

const nextConfig: NextConfig = {
  // Multi-Zones: empty by default (standalone). See src/lib/base-path.ts.
  basePath: BASE_PATH || undefined,
  // Enable Turbopack for faster development
  // Enable React strict mode
  reactStrictMode: true,
  // Experimental features
  experimental: {
    // Enable optimized package imports for better performance
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Configure allowed image domains if needed
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
