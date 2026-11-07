import type { NextConfig } from "next";

// Paste pages must render per request and never be cached by a CDN, so
// Cache Components and Partial Prefetching stay off. See docs/architecture.md.
const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
