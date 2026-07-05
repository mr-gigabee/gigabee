export function Affinity() {
  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-6">
      <div className="w-[820px] rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-400 to-cyan-400" />
        <div className="px-10 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full">Routing</span>
            <span className="text-xs text-white/30 font-mono">gigabee.io · v1.5.0</span>
          </div>
          <div className="flex items-start gap-4 mb-5">
            <span className="text-4xl">🗺️</span>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">Conversation Affinity Routing</h1>
              <p className="text-sm text-blue-400/80 font-mono mt-1">orchestrator.ts → tryDispatch()</p>
            </div>
          </div>

          {/* Format: numbered steps */}
          <ol className="space-y-1.5 mb-6 text-[13.5px]">
            {[
              { n: "1", t: "First message", d: "scheduler picks the best available GPU by weighted reputation." },
              { n: "2", t: "Affinity set", d: `orchestrator stores conversationId → workerSocketId.` },
              { n: "3", t: "Follow-up turn", d: "same GPU is preferred — KV cache is already warm, first token is faster." },
              { n: "4", t: "Worker goes offline", d: "affinity cleared automatically, next turn falls back to normal selection." },
            ].map(s => (
              <li key={s.n} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 text-[11px] font-mono font-bold flex items-center justify-center">{s.n}</span>
                <span className="text-white/55 leading-snug"><span className="text-white/80 font-medium">{s.t} — </span>{s.d}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-xl bg-[#0a0d12] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-white/25 font-mono">orchestrator.ts</span>
            </div>
            <pre className="px-5 py-4 text-[12.5px] font-mono leading-relaxed text-white/70 overflow-x-auto"><code>{`// set affinity on dispatch
if (job.conversationId)
  this.conversationAffinity.set(job.conversationId, worker.socketId);

// prefer same GPU on follow-up turns
const affSocketId = this.conversationAffinity.get(job.conversationId);
const affWorker   = affSocketId
  ? eligible.find(w => w.socketId === affSocketId)
  : undefined;
selected = affWorker ?? this.weightedSelect(eligible);`}</code></pre>
          </div>
        </div>
        <div className="px-10 py-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px]">🐝</div>
            <span className="text-xs font-semibold text-white/50">Gigabee Network</span>
          </div>
          <span className="text-xs text-white/20 font-mono">Map&lt;conversationId, socketId&gt;</span>
        </div>
      </div>
    </div>
  );
}
