export function GpuSpeed() {
  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-6">
      <div className="w-[820px] rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-yellow-500 via-amber-300 to-orange-300" />
        <div className="px-10 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full">Browser Worker</span>
            <span className="text-xs text-white/30 font-mono">gigabee.io · v1.5.0</span>
          </div>
          <div className="flex items-start gap-4 mb-4">
            <span className="text-4xl">⚡</span>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">Browser Worker GPU Speed Shown Live</h1>
              <p className="text-sm text-yellow-400/80 font-mono mt-1">useBrowserWorker.ts · earn.tsx</p>
            </div>
          </div>
          <p className="text-[15px] text-white/65 leading-relaxed mb-7 max-w-[680px]">
            The earn panel now shows a live <span className="text-yellow-300 font-mono">Speed (tok/s)</span> counter — updated every 5 tokens during an active job, reset to <span className="text-yellow-300 font-mono">—</span> when idle. Before joining the hive, the worker runs a real inference benchmark so the scheduler knows your GPU's true throughput from the first job.
          </p>
          <div className="rounded-xl bg-[#0a0d12] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-white/25 font-mono">useBrowserWorker.ts · earn.tsx</span>
            </div>
            <pre className="px-5 py-4 text-[12.5px] font-mono leading-relaxed text-white/70 overflow-x-auto">{`<span style="color:#6b7280">// Update live tok/s every 5 tokens during inference</span>
<span style="color:#c678dd">if</span> (tokenIndex > <span style="color:#d19a66">0</span> && tokenIndex % <span style="color:#d19a66">5</span> === <span style="color:#d19a66">0</span>) <span style="color:#abb2bf">{</span>
  <span style="color:#c678dd">const</span> elapsed = (performance.<span style="color:#61afef">now</span>() - jobStartRef.current) / <span style="color:#d19a66">1000</span>;
  <span style="color:#61afef">setCurrentTps</span>(elapsed > <span style="color:#d19a66">0</span> ? Math.<span style="color:#61afef">round</span>(tokenIndex / elapsed) : <span style="color:#d19a66">0</span>);
<span style="color:#abb2bf">}</span>

<span style="color:#6b7280">// Stat card: Speed replaces the old static "Model: Bee Nano"</span>
<span style="color:#abb2bf">{</span> label: <span style="color:#98c379">"Speed"</span>, value: bw.currentTps > <span style="color:#d19a66">0</span>
    ? <span style="color:#98c379">\`\${bw.currentTps} tok/s\`</span>
    : <span style="color:#98c379">"—"</span>, mono: <span style="color:#d19a66">true</span> <span style="color:#abb2bf">}</span>

<span style="color:#6b7280">// Dedicated benchmark panel (distinct from model loading)</span>
<span style="color:#abb2bf">{</span>bw.status === <span style="color:#98c379">"benchmarking"</span> && <span style="color:#abb2bf">(</span>
  &lt;p&gt;<span style="color:#98c379">"Measuring GPU speed… (~10 s)"</span>&lt;/p&gt;
<span style="color:#abb2bf">)}</span>`}</pre>
          </div>
        </div>
        <div className="px-10 py-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px]">🐝</div>
            <span className="text-xs font-semibold text-white/50">Gigabee Network</span>
          </div>
          <span className="text-xs text-white/20 font-mono">sampled every 5 tokens · resets on job end</span>
        </div>
      </div>
    </div>
  );
}
