import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
