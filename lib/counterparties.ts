export const TREASURY_VAULT = "0x1111111111111111111111111111111111111111";
export const VENDOR_DESK = "0x5555555555555555555555555555555555555555";
export const SWAP_ROUTER = "0x2222222222222222222222222222222222222222";
export const REJECTED_A = "0x9999999999999999999999999999999999999999";
export const REJECTED_B = "0x8888888888888888888888888888888888888888";
export const OPS_WALLET = "0x7777777777777777777777777777777777777777";
export const FRESH_WALLET = "0xabcabcabcabcabcabcabcabcabcabcabcabcabca";

export const UNKNOWN_LABEL = "Unlabeled";

export const COUNTERPARTY_LABELS: Record<string, string> = {
  [TREASURY_VAULT.toLowerCase()]: "Treasury Vault",
  [VENDOR_DESK.toLowerCase()]: "Vendor Desk",
  [SWAP_ROUTER.toLowerCase()]: "Swap Router",
  [REJECTED_A.toLowerCase()]: "Rejected recipient A",
  [REJECTED_B.toLowerCase()]: "Rejected recipient B",
  [OPS_WALLET.toLowerCase()]: "Ops Wallet",
};

export const AGENT_NAME = "Alex";
