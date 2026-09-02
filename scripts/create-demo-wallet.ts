import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const envPath = path.join(process.cwd(), ".env.local");
const gitignorePath = path.join(process.cwd(), ".gitignore");
const walletPath = path.join(process.cwd(), "config/demo-wallet.json");

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
  if (/^DEMO_WALLET_PRIVATE_KEY=.+$/m.test(existing)) {
    console.error("DEMO_WALLET_PRIVATE_KEY already exists in .env.local. Pass --force to replace it.");
    process.exit(1);
  }
}

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
env = upsertEnv(env, "DEMO_WALLET_PRIVATE_KEY", privateKey);
env = upsertEnv(env, "DEMO_WALLET_ADDRESS", account.address);
writeFileSync(envPath, env.endsWith("\n") ? env : `${env}\n`, { mode: 0o600 });

writeFileSync(
  walletPath,
  `${JSON.stringify({ address: account.address, network: "sepolia", role: "demo-buyer" }, null, 2)}\n`,
);

console.log("Demo buyer wallet created.");
console.log(`Address:  ${account.address}`);
console.log("Key written to .env.local as DEMO_WALLET_PRIVATE_KEY (gitignored).");
console.log("Public address written to config/demo-wallet.json.");
console.log("Fund this address with Base Sepolia ETH for gas and repayments, then set the same key on Vercel.");
