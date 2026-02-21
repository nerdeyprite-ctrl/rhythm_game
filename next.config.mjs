import {
  PHASE_DEVELOPMENT_SERVER
} from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    reactStrictMode: true,
    distDir: isDevServer ? ".next-dev" : ".next-prod",
    allowedDevOrigins: ["127.0.0.1", "localhost"]
  };
}
