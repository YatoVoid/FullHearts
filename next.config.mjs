/** @type {import('next').NextConfig} */

// Served at the root of the custom domain (fullhearts.app). For a GitHub Pages
// *project* site (no domain) set NEXT_PUBLIC_BASE_PATH="/FullHearts".
const raw = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = raw === undefined ? "" : raw;

// Static HTML export by default — the whole site is served by nginx as plain
// files, no Node runtime needed. Everything still works without the API routes:
//   - loader versions are fully PINNED (lib/modpack/mrpack.ts), so Forge/NeoForge
//     packs build with no /api/loader-version call;
//   - jar manifests are read CLIENT-SIDE (Modrinth's CDN allows cross-origin
//     reads), so dependency/version/MC checks run without /api/manifest-deps.
// Set NEXT_NODE_SERVER=1 to build for a Node host instead (`next start`), which
// turns the API routes back on and moves manifest reading server-side (one
// shared, cached download instead of per-visitor).
const nodeServer = process.env.NEXT_NODE_SERVER === "1";

const nextConfig = {
  ...(nodeServer ? {} : { output: "export" }),
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined
};

export default nextConfig;
