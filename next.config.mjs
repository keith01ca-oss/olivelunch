/** @type {import('next').NextConfig} */
// Trigger redeploy to pick up live environment variables
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'unpdf'],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
