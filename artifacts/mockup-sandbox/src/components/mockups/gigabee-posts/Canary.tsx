export function Canary() {
  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-6">
      <div className="w-[820px] rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-400" />
        <div className="px-10 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full">Quality Control</span>
            <span className="text-xs text-white/30 font-mono">gigabee.io · v1.5.0</span>
          </div>
          <div className="flex items-start gap-4 mb-5">
            <span className="text-4xl">🐝</span>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">Canary Quality Probes</h1>
              <p className="text-sm text-amber-400/80 font-mono mt-1">orchestrator.ts → finishJob()</p>
            </div>
          </div>

          {/* Format: plain paragraph with inline highlights */}
          <p className="text-[14.5px] text-white/60 leading-relaxed mb-2">
            Every ~50 completed jobs, the orchestrator fires a silent test job at the same worker — a question with a known answer. The worker doesn't know. If it answers correctly, reputation goes{" "}
            <span className="text-green-400 font-mono font-semibold">+0.05</span>. Wrong answer:{" "}
            <span className="text-red-400 font-mono font-semibold">−0.10</span>.
            No billing, no DB write, invisible to users.
          </p>

          <div className="rounded-xl bg-[#0a0d12] border border-white/5 overflow-hidden mt-6">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-white/25 font-mono">orchestrator.ts</span>
            </div>
            <pre className="px-5 py-4 text-[12.5px] font-mono leading-relaxed text-white/70 overflow-x-auto"><code>{`// ~2% of real jobs trigger a silent canary
if (!job.isCanary && Math.random() < CANARY_PROB) {
  setTimeout(() => {
    const w = this.workers.get(socketId);
    if (w && !w.currentJobId) this.runCanaryCheck(w);
  }, 500);
}

// Result: no billing, no DB write, just a rep nudge
const correct = pair.keywords.some(k => answerText.includes(k));
const delta   = correct ? 0.05 : -0.1;
w.reputation  = Math.min(1, Math.max(0, w.reputation + delta));
return; // exits finishJob without recording anything`}</code></pre>
          </div>
        </div>
        <div className="px-10 py-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px]">🐝</div>
            <span className="text-xs font-semibold text-white/50">Gigabee Network</span>
          </div>
          <span className="text-xs text-white/20 font-mono">CANARY_PROB = 0.02</span>
        </div>
      </div>
    </div>
  );
}
