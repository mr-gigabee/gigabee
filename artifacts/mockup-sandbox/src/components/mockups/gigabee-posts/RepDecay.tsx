export function RepDecay() {
  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-6">
      <div className="w-[820px] rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-purple-400 to-pink-400" />
        <div className="px-10 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20 px-3 py-1 rounded-full">Worker Fairness</span>
            <span className="text-xs text-white/30 font-mono">gigabee.io · v1.5.0</span>
          </div>
          <div className="flex items-start gap-4 mb-4">
            <span className="text-4xl">⏳</span>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">Reputation Decay for Idle Workers</h1>
              <p className="text-sm text-violet-400/80 font-mono mt-1">orchestrator.ts → decayReputation()</p>
            </div>
          </div>
          <p className="text-[15px] text-white/65 leading-relaxed mb-7 max-w-[680px]">
            Every 10 minutes, the orchestrator scans all workers. Any worker idle for more than 1 hour with a reputation above or below <span className="text-violet-300 font-mono">0.5</span> gets its score stepped <span className="text-violet-300 font-mono">0.02</span> toward neutral. A good score earned months ago doesn't grant VIP priority after a long absence — reputation stays tied to recent work, not past glory.
          </p>
          <div className="rounded-xl bg-[#0a0d12] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-white/25 font-mono">orchestrator.ts · runs every 10 min</span>
            </div>
            <pre className="px-5 py-4 text-[12.5px] font-mono leading-relaxed text-white/70 overflow-x-auto">{`<span style="color:#6b7280">// Kick off the decay loop at startup</span>
<span style="color:#e06c75">this</span>.decayInterval = <span style="color:#61afef">setInterval</span>(
  () => <span style="color:#e06c75">this</span>.<span style="color:#61afef">decayReputation</span>(), <span style="color:#d19a66">10</span> * <span style="color:#d19a66">60</span> * <span style="color:#d19a66">1_000</span>
);

<span style="color:#c678dd">private</span> <span style="color:#61afef">decayReputation</span>() <span style="color:#abb2bf">{</span>
  <span style="color:#c678dd">const</span> now = Date.<span style="color:#61afef">now</span>();
  <span style="color:#c678dd">for</span> (<span style="color:#c678dd">const</span> w <span style="color:#c678dd">of</span> <span style="color:#e06c75">this</span>.workers.<span style="color:#61afef">values</span>()) <span style="color:#abb2bf">{</span>
    <span style="color:#c678dd">if</span> (w.reputation === <span style="color:#d19a66">0.5</span>) <span style="color:#c678dd">continue</span>;         <span style="color:#6b7280">// already neutral</span>
    <span style="color:#c678dd">if</span> (now - w.lastHeartbeat < <span style="color:#e5c07b">DECAY_AFTER_MS</span>) <span style="color:#c678dd">continue</span>; <span style="color:#6b7280">// &lt;1h idle</span>
    <span style="color:#c678dd">const</span> dir  = w.reputation > <span style="color:#d19a66">0.5</span> ? <span style="color:#d19a66">-1</span> : <span style="color:#d19a66">1</span>;
    <span style="color:#c678dd">const</span> next = w.reputation + dir * <span style="color:#d19a66">0.02</span>;
    w.reputation = Math.<span style="color:#61afef">abs</span>(next - <span style="color:#d19a66">0.5</span>) &lt; <span style="color:#d19a66">0.02</span>
      ? <span style="color:#d19a66">0.5</span> : Math.<span style="color:#61afef">min</span>(<span style="color:#d19a66">1</span>, Math.<span style="color:#61afef">max</span>(<span style="color:#d19a66">0</span>, next));
  <span style="color:#abb2bf">}</span>
<span style="color:#abb2bf">}</span>`}</pre>
          </div>
        </div>
        <div className="px-10 py-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px]">🐝</div>
            <span className="text-xs font-semibold text-white/50">Gigabee Network</span>
          </div>
          <span className="text-xs text-white/20 font-mono">DECAY_AFTER_MS = 3 600 000</span>
        </div>
      </div>
    </div>
  );
}
