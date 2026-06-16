/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export so the whole site can be served by GitHub Pages (no
  // server). The mod pool is fetched client-side straight from Modrinth.
  output: "export",
  images: { unoptimized: true },
  // Custom domain (fullhearts.pro) serves at the root, so no basePath needed.
  trailingSlash: true
};

export default nextConfig;
