export function HmacReceipts() {
  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-6">
      <div className="w-[820px] rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-600 via-sky-400 to-teal-300" />
        <div className="px-10 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-full">Earnings Integrity</span>
            <span className="text-xs text-white/30 font-mono">gigabee.io · v1.5.0</span>
          </div>
          <div className="flex items-start gap-4 mb-4">
            <span className="text-4xl">🧾</span>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">HMAC-Signed Earning Receipts</h1>
              <p className="text-sm text-cyan-400/80 font-mono mt-1">receipts.ts · GET /api/earnings/receipts</p>
            </div>
          </div>
          <p className="text-[15px] text-white/65 leading-relaxed mb-7 max-w-[680px]">
            Every earning entry returned by <span className="text-cyan-300 font-mono">GET /api/earnings/receipts</span> carries an HMAC-SHA256 signature over <span className="text-cyan-300 font-mono">workerId:jobId:usdMicro:timestampMs</span>. Workers can call <span className="text-cyan-300 font-mono">verifyEarningReceipt()</span> offline — no server trust required — to confirm a record hasn't been tampered with.
          </p>
          <div className="rounded-xl bg-[#0a0d12] border border-white/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-white/25 font-mono">receipts.ts</span>
            </div>
            <pre className="px-5 py-4 text-[12.5px] font-mono leading-relaxed text-white/70 overflow-x-auto">{`<span style="color:#c678dd">import</span> <span style="color:#abb2bf">{</span> createHmac <span style="color:#abb2bf">}</span> <span style="color:#c678dd">from</span> <span style="color:#98c379">"crypto"</span>;

<span style="color:#c678dd">export function</span> <span style="color:#61afef">signEarningReceipt</span>(payload: <span style="color:#abb2bf">{</span>
  workerId: number; jobId: string;
  usdMicro: number; timestampMs: number;
<span style="color:#abb2bf">}</span>): string <span style="color:#abb2bf">{</span>
  <span style="color:#c678dd">const</span> msg = <span style="color:#98c379">\`\${payload.workerId}:\${payload.jobId}:\${payload.usdMicro}:\${payload.timestampMs}\`</span>;
  <span style="color:#c678dd">return</span> <span style="color:#61afef">createHmac</span>(<span style="color:#98c379">"sha256"</span>, SESSION_SECRET).<span style="color:#61afef">update</span>(msg).<span style="color:#61afef">digest</span>(<span style="color:#98c379">"hex"</span>);
<span style="color:#abb2bf">}</span>

<span style="color:#c678dd">export function</span> <span style="color:#61afef">verifyEarningReceipt</span>(payload, signature: string): boolean <span style="color:#abb2bf">{</span>
  <span style="color:#c678dd">return</span> <span style="color:#61afef">signEarningReceipt</span>(payload) === signature; <span style="color:#6b7280">// offline, trustless</span>
<span style="color:#abb2bf">}</span>`}</pre>
          </div>
        </div>
        <div className="px-10 py-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-[10px]">🐝</div>
            <span className="text-xs font-semibold text-white/50">Gigabee Network</span>
          </div>
          <span className="text-xs text-white/20 font-mono">HMAC-SHA256 · key: SESSION_SECRET</span>
        </div>
      </div>
    </div>
  );
}
