export function ModelHash() {
  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-6">
      <div className="w-[820px] rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-green-400 to-teal-400" />
        <div className="px-10 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full">Trust & Security</span>
            <span className="text-xs text-white/30 font-mono">gigabee.io · v1.5.0</span>
          </div>
          <div className="flex items-start gap-4 mb-5">
            <span className="text-4xl">🔐</span>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">Model Hash Verification</h1>
              <p className="text-sm text-emerald-400/80 font-mono mt-1">orchestrator.ts → registerWorker()</p>
            </div>
          </div>

          {/* Format: two-column comparison cards */}
          <div className="grid grid-cols-3 gap-3 mb-6 text-[12.5px]">
            {[
              { label: "No hash supplied", rep: "0.5", color: "text-white/40", bg: "bg-white/[0.03]", border: "border-white/5" },
              { label: "Hash ✓ matches", rep: "0.6", color: "text-green-400", bg: "bg-green-500/[0.06]", border: "border-green-500/20" },
              { label: "Hash ✗ mismatch", rep: "0.4", color: "text-red-400", bg: "bg-red-500/[0.06]", border: "border-red-500/20" },
            ].map(c => (
              <div key={c.label} className={`rounded-xl border ${c.border} ${c.bg} px-4 py-3 text-center`}>
                <p className="text-white/50 text-[11px] mb-2 leading-tight">{c.label}</p>
                <p className={`font-mono text-xl font-bold ${c.color}`}>{c.rep}</p>
                <p className="text-white/30 text-[10px] mt-1">starting rep</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl bg-[#0a0d12] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-white/25 font-mono">orchestrator.ts</span>
            </div>
            <pre className="px-5 py-4 text-[12.5px] font-mono leading-relaxed text-white/70 overflow-x-auto"><code>{`let startingReputation = 0.5; // default — unverified

if (payload.modelHash) {
  const hasMatch = payload.models.some(m => {
    const expected = KNOWN_MODEL_HASHES[m];
    return expected && payload.modelHash === expected;
  });
  startingReputation = hasMatch ? 0.6 : 0.4;
}`}</code></pre>
          </div>
        </div>
        <div className="px-10 py-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px]">🐝</div>
            <span className="text-xs font-semibold text-white/50">Gigabee Network</span>
          </div>
          <span className="text-xs text-white/20 font-mono">verified → rep 0.6 · mismatch → rep 0.4</span>
        </div>
      </div>
    </div>
  );
}
