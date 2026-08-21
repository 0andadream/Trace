import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envPath = path.join(process.cwd(), ".env.local");
const gitignorePath = path.join(process.cwd(), ".gitignore");
const walletPath = path.join(process.cwd(), "config/agent-wallet.json");

function gitignoreHasEnvLocal() {
  if (!existsSync(gitignorePath)) return false;
  return readFileSync(gitignorePath, "utf8")
    .split(/\r?\n/)
    .some((line) => line.trim() === ".env.local");
}

function upsertEnv(contents: string, key: string, value: string) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(contents)) return contents.replace(re, line);
  const trimmed = contents.replace(/\s+$/, "");
  return `${trimmed ? `${trimmed}\n` : ""}${line}\n`;
}

const force = process.argv.includes("--force");

if (!gitignoreHasEnvLocal()) {
  console.error(".gitignore does not list .env.local. Aborting so the private key cannot be committed.");
  process.exit(1);
}

if (existsSync(envPath) && !force) {
  const existing = readFileSync(envPath, "utf8");
  if (/^AGENT_PRIVATE_KEY=.+$/m.test(existing)) {
    console.error("AGENT_PRIVATE_KEY already exists in .env.local. Pass --force to replace it.");
    process.exit(1);
  }
}

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
env = upsertEnv(env, "AGENT_PRIVATE_KEY", privateKey);
env = upsertEnv(env, "BASE_PRIVATE_KEY", privateKey);
if (!/^SEPOLIA_RPC_URL=/m.test(env)) env = upsertEnv(env, "SEPOLIA_RPC_URL", "https://sepolia.base.org");
if (!/^BASE_RPC_URL=/m.test(env)) env = upsertEnv(env, "BASE_RPC_URL", "https://sepolia.base.org");
if (!/^BASE_CHAIN_ID=/m.test(env)) env = upsertEnv(env, "BASE_CHAIN_ID", "84532");
if (!/^BASE_EXECUTE=/m.test(env)) env = upsertEnv(env, "BASE_EXECUTE", "1");
if (!/^MAX_TX_AMOUNT_USDC=/m.test(env)) env = upsertEnv(env, "MAX_TX_AMOUNT_USDC", "25");
writeFileSync(envPath, env.endsWith("\n") ? env : `${env}\n`, { mode: 0o600 });

mkdirSync(path.dirname(walletPath), { recursive: true });
writeFileSync(
  walletPath,
  `${JSON.stringify({ address: account.address, network: "sepolia" }, null, 2)}\n`,
);

console.log("Address:     ", account.address);
console.log("Private key: ", privateKey);
console.log("");
console.log("Shown once. Private key written to .env.local (gitignored).");
console.log("Public address written to config/agent-wallet.json.");
console.log("Fund this address on Base Sepolia, then set BASE_EXECUTE=1.");
