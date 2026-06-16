/** @type {import('next').NextConfig} */

// GitHub Pages project site: served from /<repo>. Set NEXT_PUBLIC_BASE_PATH=""
// when you move to a root/custom domain. Unset defaults to "/FullHearts".
const raw = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = raw === undefined ? "/FullHearts" : raw;

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
