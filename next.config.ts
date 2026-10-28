import type { NextConfig } from "next";

const managedBuild = process.env.MEDCODE_BUILD_WORKER_THREADS === "1";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: managedBuild ? ".next-managed" : ".next",
  // Opt-in for local environments that block build subprocesses. Vercel uses
  // the default worker configuration when this flag is absent.
  experimental: managedBuild ? { workerThreads: true, useTypeScriptCli: false, cpus: 2 } : undefined,
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default nextConfig;
