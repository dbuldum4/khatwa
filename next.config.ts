import type { NextConfig } from "next";

const isElectron = process.env.ELECTRON_BUILD === "1";
const isNetlify = process.env.NETLIFY === "true";

// Use static export for Electron and Netlify deployments
const useStaticExport = isElectron || isNetlify;

const nextConfig: NextConfig = {
  output: useStaticExport ? "export" : undefined,
  images: useStaticExport ? { unoptimized: true } : undefined,
};

export default nextConfig;
