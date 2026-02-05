import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@epyc/shared'],
  },
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  transpilePackages: ['@epyc/shared'],
};

export default nextConfig;
