import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  env: {
    DEVHUB_ROOT: path.resolve(__dirname),
  },
};

export default nextConfig;
