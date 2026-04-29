import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.0.0.*", "192.168.*.*", "172.16.*.*"],
  // Let Node.js load pdfjs-dist natively — prevents webpack from bundling it
  // and mangling its internal worker references in server-side API routes.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
