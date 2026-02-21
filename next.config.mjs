import {
  PHASE_DEVELOPMENT_SERVER
} from "next/constants.js";

/** @type {(phase: string) => import('next').NextConfig} */
export default function nextConfig(phase) {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
  const isGithubActions = process.env.GITHUB_ACTIONS === "true";
  const repositoryName =
    process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
  const useProjectBasePath =
    isGithubActions &&
    repositoryName.length > 0 &&
    !repositoryName.endsWith(".github.io");
  const basePath = useProjectBasePath ? `/${repositoryName}` : "";

  return {
    reactStrictMode: true,
    distDir: isDevServer ? ".next-dev" : ".next-prod",
    allowedDevOrigins: ["127.0.0.1", "localhost"],
    output: isGithubActions ? "export" : undefined,
    images: {
      unoptimized: true
    },
    trailingSlash: isGithubActions,
    basePath,
    assetPrefix: basePath || undefined
  };
}
