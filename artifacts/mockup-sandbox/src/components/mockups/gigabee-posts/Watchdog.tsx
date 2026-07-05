export function Watchdog() {
  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-6">
      <div className="w-[820px] rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-rose-600 via-red-400 to-pink-400" />
        <div className="px-10 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full">Error Resilience</span>
            <span className="text-xs text-white/30 font-mono">gigabee.io · v1.5.0</span>
          </div>
          <div className="flex items-start gap-4 mb-4">
            <span className="text-4xl">🐕</span>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">Download Watchdog</h1>
              <p className="text-sm text-rose-400/80 font-mono mt-1">useBrowserWorker.ts · watchdogRef</p>
            </div>
          </div>
          <p className="text-[15px] text-white/65 leading-relaxed mb-7 max-w-[680px]">
            The first time a browser worker runs, it downloads ~400 MB of model weights. A 90-second watchdog timer starts with the download. If no progress event arrives inside that window — dropped connection, CDN hiccup, tab throttling — the worker surfaces a clear error and resets, instead of hanging at "Downloading… 34%" until the user force-refreshes.
          </p>
          <div className="rounded-xl bg-[#0a0d12] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-white/25 font-mono">useBrowserWorker.ts</span>
            </div>
            <pre className="px-5 py-4 text-[12.5px] font-mono leading-relaxed text-white/70 overflow-x-auto">{`<span style="color:#6b7280">// 90-second timeout begins at download start</span>
watchdogRef.current = <span style="color:#61afef">setTimeout</span>(() => <span style="color:#abb2bf">{</span>
  <span style="color:#c678dd">if</span> (!mountedRef.current) <span style="color:#c678dd">return</span>;
  <span style="color:#61afef">setStatus</span>(<span style="color:#98c379">"error"</span>);
  <span style="color:#61afef">setErrorMessage</span>(
    <span style="color:#98c379">"Model download timed out. Check your connection and retry."</span>
  );
  <span style="color:#61afef">cleanup</span>();                 <span style="color:#6b7280">// resets all refs</span>
<span style="color:#abb2bf">}</span>, <span style="color:#d19a66">90_000</span>);

<span style="color:#6b7280">// Cleared the moment model loads into GPU memory</span>
<span style="color:#61afef">clearTimeout</span>(watchdogRef.current);
watchdogRef.current = <span style="color:#d19a66">null</span>;

<span style="color:#6b7280">// Also cleared in cleanup() on stop / unmount</span>
<span style="color:#c678dd">if</span> (watchdogRef.current) <span style="color:#abb2bf">{</span>
  <span style="color:#61afef">clearTimeout</span>(watchdogRef.current);
  watchdogRef.current = <span style="color:#d19a66">null</span>;
<span style="color:#abb2bf">}</span>`}</pre>
          </div>
        </div>
        <div className="px-10 py-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px]">🐝</div>
            <span className="text-xs font-semibold text-white/50">Gigabee Network</span>
          </div>
          <span className="text-xs text-white/20 font-mono">timeout: 90 000 ms · resets on engine ready</span>
        </div>
      </div>
    </div>
  );
}
