/**
 * Admin-only. Deletes Sibyl USER_RELATIONSHIP for the demo buyer wallet.
 * Does not wipe the rest of the store. Not a public HTTP route.
 *
 *   pnpm demo:reset
 */
import { getDemoWalletAddress } from "@/lib/bnpl/demoWallet";
import { deleteRelationship, getRelationship } from "@/lib/bnpl/store";
import { loadEnvLocal } from "./env";

async function main() {
  loadEnvLocal();
  const wallet = getDemoWalletAddress();
  const before = await getRelationship(wallet);
  const result = await deleteRelationship(wallet);
  const after = await getRelationship(wallet);
  console.log("Demo wallet Sibyl book reset (this address only).");
  console.log(`Wallet:           ${wallet}`);
  console.log(`Deleted:          ${result.deleted}`);
  console.log(`Purchases before: ${before.total_purchases}`);
  console.log(`Purchases after:  ${after.total_purchases}`);
  if (after.total_purchases !== 0) {
    console.error("Relationship still has purchases after delete.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
