export function getConvexEnv() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return { url, configured: Boolean(url) };
}
