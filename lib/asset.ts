// On GitHub Pages project sites the app is served from /<repo>, so raw
// references to files in /public must be prefixed. Set NEXT_PUBLIC_BASE_PATH=""
// (empty) when moving to a root/custom domain. Unset defaults to "/FullHearts".
const raw = process.env.NEXT_PUBLIC_BASE_PATH;
export const BASE_PATH = raw === undefined ? "/FullHearts" : raw;

/** Prefix a /public asset path with the deployment base path. */
export const asset = (path: string): string => `${BASE_PATH}${path}`;

export const HEART_SRC = asset("/heart.png");
