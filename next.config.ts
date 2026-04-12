import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Parent folder has another lockfile; pin tracing to this app so `next build` is stable
  outputFileTracingRoot: appDir,
};

export default nextConfig;
