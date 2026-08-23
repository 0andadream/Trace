/**
 * Safety backup of the live Sibyl store (Redis on Vercel, JSON file locally).
 * Not a reset. Writes all USER_RELATIONSHIP / action / event records to JSON.
 *
 *   pnpm memory:export
 *   pnpm memory:export .data/sibyl-backup.json
 *
 * For production Redis from your laptop, pull env first:
 *   npx vercel env pull .env.kv --environment production
 *   then set KV_REST_API_URL / KV_REST_API_TOKEN in the shell.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { exportAll, pingStore } from "@/lib/memory/persist";

async function main() {
  const out = path.resolve(process.argv[2] || `.data/sibyl-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const store = await pingStore();
  const dump = await exportAll();
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        backend: store.backend,
        label: store.label,
        note: "Backup of Sibyl entities. Standing/limit are recomputed from purchases on read, not stored.",
        data: dump,
      },
      null,
      2,
    ),
  );
  const tenants = Object.keys(dump.tenants);
  const rels = tenants.reduce((n, t) => n + Object.keys(dump.tenants[t].entities.relationship || {}).length, 0);
  console.log(`Wrote ${out}`);
  console.log(`backend=${store.backend} tenants=${tenants.length} relationships=${rels}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
