import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not bundle these — native binaries and path resolution (e.g. @sparticuz/chromium).
  serverExternalPackages: [
    "@sparticuz/chromium",
    "playwright-core",
    "playwright",
  ],
};

export default nextConfig;
