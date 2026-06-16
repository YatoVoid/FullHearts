/** @type {import('next').NextConfig} */

// Served at the root of the custom domain (fullhearts.app). For a GitHub Pages
// *project* site (no domain) set NEXT_PUBLIC_BASE_PATH="/FullHearts".
const raw = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = raw === undefined ? "" : raw;

const nextConfig = {
  // Static HTML export so the whole site can be served by GitHub Pages (no
  // server). The mod pool is fetched client-side straight from Modrinth.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined
};

export default nextConfig;
