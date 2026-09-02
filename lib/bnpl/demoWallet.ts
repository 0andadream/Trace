import { isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import demoWalletFile from "@/config/demo-wallet.json";
import { getAgentAddress } from "@/lib/wallet";

function rawKey() {
  return (process.env.DEMO_WALLET_PRIVATE_KEY || "").trim();
}

export function demoWalletConfigured() {
  return Boolean(rawKey());
}

export function getDemoWalletAccount(): PrivateKeyAccount {
  const raw = rawKey();
  if (!raw) {
    throw new Error(
      "DEMO_WALLET_PRIVATE_KEY is missing. Run `pnpm demo:wallet` and fund the printed address on Base Sepolia.",
    );
  }
  const account = privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
  try {
    if (account.address.toLowerCase() === getAgentAddress().toLowerCase()) {
      throw new Error("DEMO_WALLET_PRIVATE_KEY must be a different key from AGENT_PRIVATE_KEY.");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("must be a different key")) throw err;
  }
  return account;
}

/** Public address. Does not require the private key. */
export function getDemoWalletAddress(): Address {
  try {
    return getDemoWalletAccount().address;
  } catch (err) {
    if (err instanceof Error && err.message.includes("must be a different key")) throw err;
    const envAddr = process.env.DEMO_WALLET_ADDRESS?.trim();
    const published = typeof demoWalletFile.address === "string" ? demoWalletFile.address.trim() : "";
    const raw = envAddr || published;
    if (raw && isAddress(raw, { strict: false })) return raw as Address;
    throw new Error("Demo wallet address is missing. Set DEMO_WALLET_PRIVATE_KEY or DEMO_WALLET_ADDRESS.");
  }
}
