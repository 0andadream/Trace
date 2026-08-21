const STEPS = [
  { k: "01", t: "Request" },
  { k: "02", t: "Memory" },
  { k: "03", t: "Risk" },
  { k: "04", t: "Decide" },
  { k: "05", t: "Record" },
];

export function FlowStrip() {
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {STEPS.map((s, i) => (
        <li key={s.k} className="panel flex items-center gap-3 px-4 py-3">
          <span className="font-mono text-[10px] text-trace">{s.k}</span>
          <span className="text-sm">{s.t}</span>
          {i < STEPS.length - 1 ? (
            <span className="ml-auto hidden text-trace/50 sm:inline">→</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
