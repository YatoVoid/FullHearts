// Served at the root of the custom domain (fullhearts.app), so no prefix. For a
// GitHub Pages *project* site (no domain) set NEXT_PUBLIC_BASE_PATH="/FullHearts".
const raw = process.env.NEXT_PUBLIC_BASE_PATH;
export const BASE_PATH = raw === undefined ? "" : raw;

/** Prefix a /public asset path with the deployment base path. */
export const asset = (path: string): string => `${BASE_PATH}${path}`;

export const HEART_SRC = asset("/heart.png");
