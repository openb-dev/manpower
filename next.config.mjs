/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    agentUpgrade: "security",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
