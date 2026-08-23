const EXPLORER = "https://sepolia.basescan.org/tx/";

export function txExplorerUrl(hash: string) {
  const h = hash.startsWith("0x") ? hash : `0x${hash}`;
  return `${EXPLORER}${h}`;
}

export function TxLink({ hash, className = "" }: { hash: string; className?: string }) {
  const h = hash.startsWith("0x") ? hash : `0x${hash}`;
  return (
    <a
      href={txExplorerUrl(h)}
      target="_blank"
      rel="noreferrer"
      className={`font-mono text-[#7828E8] underline decoration-[#7828E8]/40 underline-offset-2 hover:text-[#6a1fd4] hover:decoration-[#6a1fd4] ${className}`}
    >
      {h}
    </a>
  );
}
