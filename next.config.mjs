/** @type {import('next').NextConfig} */

// Served at the root of the custom domain (fullhearts.app). For a GitHub Pages
// *project* site (no domain) set NEXT_PUBLIC_BASE_PATH="/FullHearts".
const raw = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = raw === undefined ? "" : raw;

// Static export is now OPT-IN (set NEXT_STATIC_EXPORT=1). A static export has NO
// API routes, which disables the server-side jar-manifest cache (/api/manifest-deps)
// and loader-version lookup — so the default build is a normal Node server that
// keeps those routes. Use `NEXT_STATIC_EXPORT=1 next build` only for a no-backend
// host like GitHub Pages (the client-side fallback still keeps things working there).
const staticExport = process.env.NEXT_STATIC_EXPORT === "1";

const nextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined
};

export default nextConfig;
