"use client";

import { useEffect, useState } from "react";
import { shortAddress } from "@/lib/format";

type Eth = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function ethereum(): Eth | null {
  if (typeof window === "undefined") return null;
  const e = (window as unknown as { ethereum?: Eth }).ethereum;
  return e ?? null;
}

export function useInjectedWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const eth = ethereum();
    if (!eth) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0];
      const next = Array.isArray(accounts) ? String(accounts[0] || "") : "";
      setAddress(next ? next.toLowerCase() : null);
    };
    const onChain = (...args: unknown[]) => {
      const id = args[0];
      setChainId(typeof id === "string" ? Number.parseInt(id, 16) : Number(id) || null);
    };
    eth.request({ method: "eth_accounts" }).then((accounts) => {
      const list = accounts as string[];
      if (list?.[0]) setAddress(list[0].toLowerCase());
    });
    eth.request({ method: "eth_chainId" }).then((id) => {
      onChain(id);
    });
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  async function connect() {
    const eth = ethereum();
    if (!eth) {
      setError("No injected wallet. Install MetaMask, Rabby, or Coinbase Wallet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts[0] ? accounts[0].toLowerCase() : null);
      const id = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(id, 16));
    } catch (err) {
      setError(err instanceof Error ? err.message : "connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function switchBaseSepolia() {
    const eth = ethereum();
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x14a34" }],
      });
    } catch {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x14a34",
            chainName: "Base Sepolia",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://sepolia.base.org"],
            blockExplorerUrls: ["https://sepolia.basescan.org"],
          },
        ],
      });
    }
  }

  function disconnect() {
    setAddress(null);
  }

  return {
    address,
    chainId,
    error,
    busy,
    connected: Boolean(address),
    wrongNetwork: Boolean(address) && chainId !== null && chainId !== 84532,
    connect,
    disconnect,
    switchBaseSepolia,
  };
}

export function ConnectWallet() {
  const wallet = useInjectedWallet();

  if (wallet.connected && wallet.address) {
    return (
      <div className="flex items-center gap-2">
        {wallet.wrongNetwork ? (
          <button className="btn-hold h-8 px-3 text-xs" onClick={wallet.switchBaseSepolia} type="button">
            Switch to Base Sepolia
          </button>
        ) : (
          <span className="font-mono text-[11px] text-paper-300">{shortAddress(wallet.address)}</span>
        )}
        <button className="btn-ghost h-8 px-3 text-xs" onClick={wallet.disconnect} type="button">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button className="btn-trace h-8 px-3 text-xs" disabled={wallet.busy} onClick={wallet.connect} type="button">
        {wallet.busy ? "Connecting…" : "Connect wallet"}
      </button>
      {wallet.error ? <p className="mt-1 max-w-[14rem] text-right text-[10px] text-hold">{wallet.error}</p> : null}
    </div>
  );
}
