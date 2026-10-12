/** @type {import('next').NextConfig} */

// Served at the root of the custom domain (fullhearts.app). For a GitHub Pages
// *project* site (no domain) set NEXT_PUBLIC_BASE_PATH="/FullHearts".
const raw = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = raw === undefined ? "" : raw;

// Runs as a Node server (`next start`): sign-in, registration, billing and the
// admin dashboard all need one. NEXT_STATIC_EXPORT=1 still produces the old
// plain-files build of the mod tools, with all of those features missing.
const staticExport = process.env.NEXT_STATIC_EXPORT === "1";

const nextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined
};

export default nextConfig;
