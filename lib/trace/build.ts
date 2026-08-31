/** One build id for layout, footer, and Cache-Control. */
export function buildSha() {
  const raw =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "local";
  return raw.slice(0, 7);
}
