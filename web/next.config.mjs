import nextEnv from "@next/env";

// Ensure .env.local is applied when Next evaluates config / bundles middleware (Edge).
nextEnv.loadEnvConfig(process.cwd());

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Avoid bundling a stale Prisma client that drops model delegates (e.g. githubConnection).
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default nextConfig;
