import type { NextConfig } from "next";

const apiProxyTarget = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://adspro.naeva.id/api"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
