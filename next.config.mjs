/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    agentUpgrade: "security",
    proxyClientMaxBodySize: "20mb",
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
