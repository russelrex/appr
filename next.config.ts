import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Runtime externals + webpack externals so native binaries are not relocated.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core", "playwright"],

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "@sparticuz/chromium",
        "playwright-core",
        "playwright",
      ];
    }
    return config;
  },

  // Next 16 defaults to Turbopack; empty config acknowledges custom webpack above.
  turbopack: {},
};

export default nextConfig;
