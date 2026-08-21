import path from "node:path";

/** Vercel's serverless FS is read-only except /tmp. */
export function dataFile(name: string) {
  const root = process.env.VERCEL ? "/tmp/trace-data" : path.join(process.cwd(), ".data");
  return path.join(root, name);
}
