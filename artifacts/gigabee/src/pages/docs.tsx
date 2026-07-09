import { useState, useEffect } from "react";
import { Link } from "wouter";
import { BeeLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, MessageSquare, Coins, Menu, X, Copy, Check, ChevronRight } from "lucide-react";

type Section = {
  id: string;
  title: string;
  content: React.ReactNode;
};

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="relative group my-4">
      <pre className="bg-card border border-border rounded-xl p-4 text-sm font-mono text-foreground overflow-x-auto whitespace-pre">
        <code>{children}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-secondary border border-border hover:bg-secondary/80"
        data-testid="btn-copy-code"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-4">{children}</p>;
}

function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="text-lg font-medium text-foreground mt-8 mb-3 first:mt-0">{children}</h2>;
}

function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h3 id={id} className="text-base font-medium text-foreground mt-6 mb-2">{children}</h3>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="text-sm text-muted-foreground space-y-2 mb-4 list-none">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="text-primary mt-0.5 shrink-0">›</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-secondary mt-6">
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function Ic({ children }: { children: string }) {
  return <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">{children}</code>;
}

const sections: Section[] = [
  {
    id: "what-is-gigabee",
    title: "What is Gigabee?",
    content: (
      <>
        <P>
          Gigabee is a decentralized AI inference network. When you send a message, it doesn't go to a
          corporate data center. It goes to the Hive: a global network of GPUs contributed by people
          like you. The worker runs the model, streams the answer back word by word, and earns Honey
          (real $GB) for the work.
        </P>
        <p className="text-sm font-medium text-foreground mb-6 italic">
          AI powered by the hive, not the data center.
        </p>

        <H2>How a message travels</H2>
        <P>
          You type a message. The orchestrator checks whether a native Ollama worker is connected and
          eligible. If one is, your job goes directly to that GPU — real distributed inference. If
          none are online, it falls back to OpenRouter so you always get an answer. Either way,
          tokens stream back word by word in real time, and your prompt is never written to a
          database on our side.
        </P>

        <H2>Two models, one assistant</H2>
        <P>Bee is the assistant. She comes in two tiers:</P>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Tier</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Runs on</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Cost per message</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Best for</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="px-4 py-3 font-medium text-foreground text-xs">Bee Hover</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">OpenRouter (native GPU network in development)</td>
                <td className="px-4 py-3 text-xs text-right font-mono">10 credits</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">Fast everyday chat</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-foreground text-xs">Bee Glide</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">OpenRouter (native GPU network in development)</td>
                <td className="px-4 py-3 text-xs text-right font-mono">15 credits</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">Harder reasoning, longer answers</td>
              </tr>
            </tbody>
          </table>
        </div>
        <P>
          1 credit = $0.01. Credits never expire, and every failed job is refunded automatically.
        </P>

        <H2>Three ways to be here</H2>
        <P>
          Use Gigabee (pay per message), power it (run a worker, earn Honey), or grow it (refer
          friends, earn a share of what they spend). Most people end up doing all three.
        </P>
      </>
    ),
  },
  {
    id: "how-it-works",
    title: "How it works",
    content: (
      <>
        <H2>Current flow (OpenRouter)</H2>
        <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground mb-6 p-4 bg-secondary/40 rounded-xl border border-border font-mono">
          <span>User</span>
          <span className="text-primary">→</span>
          <span>Orchestrator</span>
          <span className="text-primary">→</span>
          <span>OpenRouter</span>
          <span className="text-primary">→</span>
          <span>tokens stream back</span>
          <span className="text-primary">→</span>
          <span>User</span>
        </div>
        <P>
          Right now, Bee runs on OpenRouter — a hosted AI routing layer that gives us access to
          a wide selection of open-source models. The orchestrator authenticates your session,
          forwards your message to OpenRouter, and streams tokens back in real time. Billing
          metadata (job id, token counts, latency, cost) is stored. Message content is never
          written to a database anywhere.
        </P>
        <Callout title="Native GPU network — in development">
          The long-term architecture routes jobs to community-owned GPUs (Hive workers) instead
          of a hosted API. That network is being built. When it launches, the flow above gains a
          real worker node between the orchestrator and the model. We list this here explicitly
          rather than pretending it's already live.
        </Callout>

        <H2>Native workers (Ollama)</H2>
        <P>
          Download <Ic>gigabee-worker.mjs</Ic> from <a href="https://raw.githubusercontent.com/mr-gigabee/gigabee/main/worker/gigabee-worker.mjs" className="text-primary underline underline-offset-2">GitHub</a> and run it on a machine with a
          dedicated GPU. The worker connects to the Gigabee orchestrator and serves inference jobs
          using Ollama running locally on your hardware. When your worker is online, real user jobs
          are dispatched directly to it. When no community workers are connected, the orchestrator
          falls back to OpenRouter so the service stays available.
        </P>

        <H2>Browser workers</H2>
        <P>
          Browser workers run entirely inside your Chrome or Edge tab using WebGPU — no install required.
          Open the <strong>Earn → Browser Worker</strong> tab, click <strong>Start Worker</strong>, and keep the tab open.
          Your GPU serves inference jobs and earns Honey ($GB) the same way native workers do.
        </P>
        <Callout title="Live — no install needed">
          WebGPU browser workers are live. Go to <a href="/earn" className="text-primary underline underline-offset-2">/earn → Browser Worker</a> to start earning from your browser today.
        </Callout>

        <H2>How jobs are assigned</H2>
        <P>
          Every worker has a reputation score built from three things: verified model integrity at
          registration, measured throughput (tok/s), and accuracy on canary quality probes. Jobs are
          assigned by weighted random selection over eligible workers — faster, more accurate workers
          receive more traffic, but newcomers always receive some jobs so they can build a track record.
        </P>
        <P>
          <strong className="text-foreground">Conversation affinity</strong> — when you send multiple
          messages in the same conversation, the orchestrator routes each follow-up turn to the same
          GPU that handled the first. This keeps the model's key-value cache warm and cuts first-token
          latency on multi-turn conversations significantly.
        </P>

        <H2>How we keep workers honest</H2>
        <P>Two mechanisms run continuously, invisibly to workers:</P>
        <Ul items={[
          "Canary probes: after ~2% of completed jobs, the network dispatches a silent shadow job using a question with a known correct answer. The worker's response is checked for the expected keywords. Correct answers nudge reputation up (+0.05); wrong answers reduce it (−0.10).",
          "Model hash verification: when a worker connects, it can optionally supply a hash of its model weights. Workers with a verified hash matching the expected value start with a reputation boost (+0.1); unverified or mismatched hashes start with a slight penalty (−0.1).",
        ]} />
        <P>
          Reputation decays back toward neutral (0.5) for workers that have been idle for more than
          an hour — so a good reputation is maintained by consistently serving quality jobs, not
          locked in forever from a single good run.
        </P>
        <P>
          A worker that repeatedly fails canary checks loses reputation and receives fewer jobs.
          Honest work is the only profitable long-term strategy. That's by design.
        </P>
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy",
    content: (
      <>
        <P>
          We designed Gigabee so that trusting us requires as little faith as possible. Here is
          exactly what exists on our servers.
        </P>
        <div className="border border-border rounded-xl overflow-x-auto my-6">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Data</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Stored?</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Why</th>
              </tr>
            </thead>
            <tbody>
              {[
                { data: "Your prompts", stored: "Never", why: "No database column exists for them" },
                { data: "Model responses", stored: "Never", why: "Relay only, memory only" },
                { data: "Chat history", stored: "On your device (localStorage)", why: "You can wipe it anytime" },
                { data: "Job metadata (token counts, latency, cost)", stored: "Yes", why: "Billing and payouts" },
                { data: "Solana wallet address", stored: "Yes", why: "Your account identity — no email, no password" },
                { data: "Deposit and payout transactions", stored: "Yes", why: "It's money; we keep books" },
                { data: "Referral relationships", stored: "Yes", why: "Commission tracking" },
              ].map((row) => (
                <tr key={row.data} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs font-medium text-foreground">{row.data}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${row.stored === "Never" ? "text-green-500 dark:text-green-400" : "text-muted-foreground"}`}>
                    {row.stored}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <P>
          Workers receive your message text in memory in order to run the model. That is unavoidable
          and true of every inference service on earth. What makes Gigabee different: workers never
          learn who you are (jobs carry no identity), never receive your history beyond the current
          conversation window you send, and cannot store what they serve without breaking integrity
          checks and forfeiting earnings.
        </P>

        <Callout title="What we don't promise">
          We are not an anonymity network, and we comply with valid legal process for the metadata we
          do hold. We will never be able to hand over your conversations, because we never have them.
          Our moderation system screens inputs in memory for a narrow set of clearly illegal content;
          it logs a category flag, not text.
        </Callout>
      </>
    ),
  },
  {
    id: "credits",
    title: "Credits & pricing",
    content: (
      <>
        <P>
          Everything is paid with credits. <strong className="text-foreground">1 credit = $0.01</strong>,
          purchased with $GB on Solana. No subscription, no expiry.
        </P>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Action</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Cost</th>
              </tr>
            </thead>
            <tbody>
              {[
                { action: "Bee Hover message", cost: "10 credits" },
                { action: "Bee Glide message", cost: "15 credits" },
                { action: "API call", cost: "Same as the equivalent tier" },
                { action: "Failed or timed-out job", cost: "0 (automatic refund)" },
              ].map((row) => (
                <tr key={row.action} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs text-foreground">{row.action}</td>
                  <td className={`px-4 py-3 text-xs text-right font-mono ${row.action === "Failed or timed-out job" ? "text-green-500 dark:text-green-400" : "text-muted-foreground"}`}>
                    {row.cost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <H2>Refunds</H2>
        <P>
          Refunds are instant and automatic: if a job fails at any point, the charge reverses in the
          same transaction that marks it failed. You'll see it in your balance immediately. Cancelled
          messages are billed only for the tokens already generated.
        </P>

        <H2>Top up</H2>
        <P>
          Top up from the credits panel in your chat sidebar. Select a package, send $GB to the treasury address in your Phantom or Solflare wallet, and credits appear in your balance after the
          transaction confirms on-chain (usually under 30 seconds). Packages:
        </P>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Package</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">$GB</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Credits</th>
                <th className="px-4 py-3 text-right font-medium text-foreground">Hover messages</th>
              </tr>
            </thead>
            <tbody>
              {[
                { pkg: "Starter",  usdc: "5 $GB",  credits: "500",   msgs: "50" },
                { pkg: "Standard", usdc: "10 $GB", credits: "1,100", msgs: "110", bonus: "+100" },
                { pkg: "Pro",      usdc: "25 $GB", credits: "2,750", msgs: "275", bonus: "+250" },
                { pkg: "Power",    usdc: "50 $GB", credits: "6,000", msgs: "600", bonus: "+1,000" },
              ].map((row) => (
                <tr key={row.pkg} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs font-medium text-foreground">{row.pkg}</td>
                  <td className="px-4 py-3 text-xs text-right font-mono text-muted-foreground">{row.usdc}</td>
                  <td className="px-4 py-3 text-xs text-right font-mono text-foreground">
                    {row.credits}
                    {row.bonus && <span className="ml-1 text-green-500 dark:text-green-400 text-xs">{row.bonus}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-right text-muted-foreground">{row.msgs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          Payments are on-chain $GB token transfers on Solana mainnet. No credit card support yet.
          Credits never expire.
        </P>
      </>
    ),
  },
  {
    id: "run-worker",
    title: "Earn: run a worker",
    content: (
      <>
        <P>
          Workers keep <strong className="text-foreground">75% of the value of every job they
          complete.</strong> 85% once staking launches. Earnings accrue as Honey, displayed in USD,
          paid in $GB.
        </P>

        <H2>How the earning flow works</H2>
        <ol className="text-sm text-muted-foreground space-y-4 mb-6 pl-0 list-none">
          {[
            {
              n: "1",
              title: "User sends a message",
              body: "A Gigabee user submits a chat. Credits are reserved from their balance (10 for Bee Hover, 15 for Bee Glide).",
            },
            {
              n: "2",
              title: "Orchestrator picks your worker",
              body: "The network matches the job to the highest-reputation available worker that serves the requested model tier. Speed and reliability score determine priority.",
            },
            {
              n: "3",
              title: "Your GPU runs inference",
              body: "The model runs locally on your machine. Tokens stream back to the user in real time through the orchestrator. Your prompt data is never written to disk anywhere.",
            },
            {
              n: "4",
              title: "Honey is credited",
              body: "Once the job completes, 75% of the credit value is credited to your Honey balance. For a Bee Glide job: 15 credits × $0.01 × 75% = $0.1125 per job.",
            },
            {
              n: "5",
              title: "24-hour integrity hold",
              body: "Honey sits in pending status for 24 hours while canary and mirror checks run. Workers that fail checks forfeit pending earnings for that job and lose reputation.",
            },
            {
              n: "6",
              title: "Withdraw to Solana",
              body: "Once matured, Honey moves to your available balance. Open the Earn page, enter a Solana wallet address, and submit a withdrawal request. $GB is sent to your wallet after the request is reviewed and approved.",
            },
          ].map((step) => (
            <li key={step.n} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card/50">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-medium mt-0.5">
                {step.n}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <H2>Earnings formula</H2>
        <P>
          The formula is fixed in the network protocol. Every completed job triggers:
        </P>
        <Code>{`earnings_USD = credits_charged × $0.01 × rate
rate = 75%  (standard)
rate = 85%  (staked, Phase 2)`}</Code>

        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Model</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Credits/job</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Rate</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Formula</th>
                <th className="px-4 py-3 text-left font-medium text-foreground text-primary">You earn</th>
              </tr>
            </thead>
            <tbody>
              {[
                { model: "Bee Hover", credits: 10, rate: "75%", formula: "10 × $0.01 × 0.75", earn: "$0.0750" },
                { model: "Bee Glide", credits: 15, rate: "75%", formula: "15 × $0.01 × 0.75", earn: "$0.1125" },
                { model: "Bee Hover (staked)", credits: 10, rate: "85%", formula: "10 × $0.01 × 0.85", earn: "$0.0850" },
                { model: "Bee Glide (staked)", credits: 15, rate: "85%", formula: "15 × $0.01 × 0.85", earn: "$0.1275" },
              ].map((row) => (
                <tr key={row.model} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs text-foreground">{row.model}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.credits}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.rate}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.formula}</td>
                  <td className="px-4 py-3 text-xs font-mono font-medium text-primary">{row.earn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <H2>Realistic earnings range</H2>
        <P>
          Jobs per hour depends on your GPU speed and actual network demand. The table below uses
          real hardware benchmarks (avg. response 300 tokens) at two utilization rates. Early
          network utilization is low, do not plan on max-load numbers.
        </P>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">GPU</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Model</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Speed</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">10% load</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">50% load</th>
              </tr>
            </thead>
            <tbody>
              {[
                // Formula: 3600 ÷ (300/speed + 5) × util × $/job
                // RTX 3060: 3600÷11.67=308 max jobs/hr → 10%→30.8×$0.075=$2.31 | 50%→154×$0.075=$11.55
                { gpu: "RTX 3060 12 GB", model: "Bee Hover", speed: "~45 t/s", low: "~$2.31/hr", mid: "~$11.55/hr" },
                // RTX 4090: 3600÷8.33=432 max → 10%→43.2×$0.075=$3.24 | 50%→216×$0.075=$16.20
                { gpu: "RTX 4090 24 GB", model: "Bee Hover", speed: "~90 t/s", low: "~$3.24/hr", mid: "~$16.20/hr" },
                // 2×RTX 3090: 3600÷35=103 max → 10%→10.3×$0.1125=$1.16 | 50%→51.4×$0.1125=$5.78
                { gpu: "2× RTX 3090 48 GB", model: "Bee Glide", speed: "~10 t/s", low: "~$1.16/hr", mid: "~$5.78/hr" },
                // A100 80GB: 3600÷15=240 max → 10%→24×$0.1125=$2.70 | 50%→120×$0.1125=$13.50
                { gpu: "A100 80 GB", model: "Bee Glide", speed: "~30 t/s", low: "~$2.70/hr", mid: "~$13.50/hr" },
              ].map((row) => (
                <tr key={row.gpu + row.model} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs text-foreground">{row.gpu}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.model}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.speed}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.low}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.mid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          Calculation: (3600 s/hr ÷ (300 tokens ÷ speed + 5 s overhead)) × utilization × earnings/job.
          These are gross estimates, not guarantees.
        </P>

        <div className="border border-border rounded-xl p-5 my-4 space-y-3">
          {[
            { label: "Maturity window", value: "24 hours, integrity checks run before Honey is spendable" },
            { label: "Payout currency", value: "$GB on Solana — withdraw to any Solana wallet from the Earn page" },
            { label: "Failed canary / mirror check", value: "Job earnings forfeited, reputation penalty applied" },
          ].map((row) => (
            <div key={row.label} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
              <span className="text-muted-foreground shrink-0">{row.label}</span>
              <span className="font-medium text-foreground text-right text-xs sm:text-sm">{row.value}</span>
            </div>
          ))}
        </div>

        <H2>Where does worker pay come from?</H2>
        <P>
          Every credit purchase is a real $GB token transfer on Solana mainnet, verified on-chain before
          credits are issued. That $GB pools in the Gigabee treasury wallet. Worker Honey is your
          allocated share of that pool, tracked in USD, paid out as $GB when you withdraw.
        </P>

        <div className="space-y-0 my-4 rounded-xl border border-border overflow-hidden">
          {[
            {
              step: "1",
              label: "User pays",
              detail: "User sends $GB to the treasury wallet on Solana mainnet. Payment is verified on-chain. Credits are issued to the user's account.",
              tag: "In: $GB",
              tagColor: "text-primary",
            },
            {
              step: "2",
              label: "Job runs on your GPU",
              detail: "Credits are debited when the job starts. Once complete, 75% of the credit value is allocated to your Honey balance (tracked in USD in the database).",
              tag: "Tracked: micro-USD",
              tagColor: "text-muted-foreground",
            },
            {
              step: "3",
              label: "24-hour hold",
              detail: "Honey stays pending while integrity checks complete. No $GB moves during this window, only the database record matures from pending to available.",
              tag: "Hold: DB only",
              tagColor: "text-muted-foreground",
            },
            {
              step: "4",
              label: "You withdraw",
              detail: "The network sends $GB from the treasury wallet to your Solana wallet, exactly equal to your available Honey balance. No token conversion, pure $GB.",
              tag: "Out: $GB",
              tagColor: "text-primary",
            },
          ].map((row, i, arr) => (
            <div key={row.step} className={`flex items-start gap-4 px-5 py-4 bg-card ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-medium mt-0.5">
                {row.step}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className="text-sm font-medium text-foreground">{row.label}</p>
                  <span className={`text-xs font-mono ${row.tagColor} shrink-0`}>{row.tag}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{row.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <P>
          The platform keeps 25% of each job's credit value to cover operating costs, OpenRouter
          inference fees (while the native worker network is being built out), and development.
          There are no hidden fees. $GB in, $GB out.
        </P>

        <Callout title="What backs your Honey?">
          Each unit of Honey is backed by $GB already received by the treasury wallet on Solana.
          Honey is not a separate token — it is an IOU against $GB the network has already
          collected. No conversion required: the $GB is already in the treasury when you withdraw.
          <br /><em className="text-xs opacity-70">(Updated: previously USDC, now $GB token — CA: 7NcMKMrXPBVCWPcs9SSqnF6ZGy5neAtzTZpFqZqLquaP)</em>
        </Callout>

        <H2>Native quickstart</H2>
        <ol className="text-sm text-muted-foreground space-y-2 mb-6 pl-0 list-none">
          {[
            "Install Ollama from ollama.ai and pull a model: ollama pull llama3.3:70b",
            "Download gigabee-worker.mjs (see Step 5 below for your OS)",
            "Set your session token: export GIGABEE_TOKEN=<your-token>  (copy it from the Earn page)",
            "Run: node gigabee-worker.mjs  — worker warm-ups, benchmarks, then waits for jobs",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-medium mt-0.5">
                {i + 1}
              </span>
              <span className="font-mono text-xs">{step}</span>
            </li>
          ))}
        </ol>

        <Code>{`# Full example
export GIGABEE_TOKEN=your-session-token
export GIGABEE_MODELS=bee-glide,bee-hover   # optional, default: bee-glide
export OLLAMA_HOST=http://localhost:11434    # optional, default
node gigabee-worker.mjs`}</Code>

        <P>
          The worker checks Ollama, runs a warm-up pass to load the model into VRAM, then runs
          a timed benchmark to measure real inference speed. After that it connects to the hive,
          registers, and starts accepting jobs automatically. It reconnects on drop and prints
          per-job earnings to stdout.
        </P>

        <H2>Supported models</H2>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">GIGABEE_MODELS value</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Ollama model</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Min VRAM</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="px-4 py-3 text-xs font-mono text-foreground">bee-hover</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">llama3.2:3b</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">4 GB</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-xs font-mono text-foreground">bee-glide</td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">llama3.3:70b</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">40 GB (or 2× 24 GB)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <H2>Hardware guide</H2>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">GPU</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Recommended tier</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {[
                { gpu: "RTX 3060 / 4060 (12 GB)", tier: "bee-hover only", note: "llama3.2:3b fits comfortably" },
                { gpu: "RTX 3090 / 4090 (24 GB)", tier: "bee-hover", note: "llama3.3:70b requires 2× or quantized" },
                { gpu: "2× RTX 3090 / A100 (40 GB+)", tier: "bee-glide + bee-hover", note: "Full quality, max earnings" },
              ].map((row) => (
                <tr key={row.gpu} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs text-foreground">{row.gpu}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.tier}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <P>
          <strong className="text-foreground">
            Earnings depend entirely on paid network usage. Nobody can promise you an income figure,
            including us.
          </strong>{" "}
          Honey accrues per job, pending 24 hours while integrity checks run.
        </P>

        <H2>Real-time worker monitor</H2>
        <P>
          The <strong className="text-foreground">Earn page → Native Worker tab</strong> shows a
          live status panel for your registered worker. It refreshes every 5 seconds and displays
          online / offline state, how long you have been connected, and your all-time job count.
          The panel is powered by a Socket.io pub/sub channel — no manual page refresh needed.
        </P>
        <P>
          The panel updates as soon as you run the worker script and connect to the hive. If you
          see <Ic>Online — idle</Ic> with a green dot, the server has confirmed your registration
          and you will be routed jobs when available.
        </P>

        <H2>Withdrawing</H2>
        <P>
          Once your Honey balance has matured past the 24-hour hold, it moves to{" "}
          <Ic>available</Ic> status. To withdraw:
        </P>
        <ol className="text-sm text-muted-foreground space-y-2 mb-4 list-none">
          {[
            "Open the Earn page and go to the Native Worker tab.",
            "Click Withdraw in the Honey earnings panel.",
            "Enter a valid Solana wallet address (Phantom, Solflare, or any SPL-compatible wallet).",
            "Confirm the amount and submit the request.",
            "$GB is sent on-chain after the payout is reviewed and approved (typically within 24 hours).",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-primary mt-0.5 shrink-0 font-mono text-xs">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <Callout title="Minimum withdrawal">
          The minimum withdrawal amount is $25.00 in $GB. Withdrawals below this threshold are
          queued until your available balance reaches the minimum.
        </Callout>
      </>
    ),
  },
  {
    id: "worker-setup",
    title: "Worker setup",
    content: (
      <>
        <P>
          Run a Gigabee worker on any machine with a GPU and earn Honey ($GB) for every inference
          job you complete. Works on Windows, macOS, and Linux — desktop, laptop, or server.
        </P>

        <H2>Requirements</H2>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Component</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Minimum</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {[
                { c: "OS",      m: "Windows 10+, macOS 12+, Linux", n: "Ubuntu 20.04+ recommended for servers" },
                { c: "Node.js", m: "v18 or newer",                  n: "v22 LTS recommended" },
                { c: "GPU",     m: "4 GB VRAM (bee-hover)",         n: "NVIDIA, AMD, or Apple Silicon" },
                { c: "RAM",     m: "8 GB",                          n: "16 GB+ recommended" },
                { c: "Disk",    m: "10 GB free",                    n: "Ollama model files" },
                { c: "Network", m: "Stable outbound",               n: "WebSocket on port 443" },
              ].map((row) => (
                <tr key={row.c} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs font-medium text-foreground">{row.c}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.m}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout title="No GPU? CPU works for testing">
          Ollama runs on CPU too, but inference is 10–50× slower and the scheduler assigns fewer
          jobs. A GPU is required for meaningful earnings.
        </Callout>

        <H2>Worker software security</H2>
        <P>
          The worker is a single Node.js script (<Ic>gigabee-worker.mjs</Ic>) that you can read in full before running.
          It does exactly three things: connects to the Gigabee orchestrator via WebSocket on port 443,
          reads Ollama's local HTTP API on <Ic>localhost:11434</Ic>, and streams tokens back.
          It does not access your filesystem beyond its own working directory, does not read environment
          variables other than <Ic>GIGABEE_TOKEN</Ic> and <Ic>GIGABEE_MODELS</Ic>, and makes no
          outbound calls except to <Ic>gigabee.io</Ic> and <Ic>localhost</Ic>.
        </P>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">The worker can</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">The worker cannot</th>
              </tr>
            </thead>
            <tbody>
              {[
                { can: "Receive inference jobs from the orchestrator", cannot: "Access your files or home directory" },
                { can: "Call Ollama on localhost:11434", cannot: "Make outbound requests to any domain except gigabee.io" },
                { can: "Read GIGABEE_TOKEN and GIGABEE_MODELS env vars", cannot: "Read other env vars or shell history" },
                { can: "Stream tokens back to the user", cannot: "Persist or log user prompt text" },
              ].map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs text-muted-foreground">✓ {r.can}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">✗ {r.cannot}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          The script is open-source — read it at{" "}
          <a href="https://github.com/mr-gigabee" className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">github.com/mr-gigabee</a>{" "}
          before running it on your machine. We encourage you to audit it.
        </P>

        <H2>Step 1 — Install Node.js</H2>
        <Tabs defaultValue="windows" className="my-4">
          <TabsList>
            <TabsTrigger value="windows">Windows</TabsTrigger>
            <TabsTrigger value="macos">macOS</TabsTrigger>
            <TabsTrigger value="linux">Linux</TabsTrigger>
          </TabsList>
          <TabsContent value="windows" className="mt-3">
            <P>Download the Windows installer from <a href="https://nodejs.org" className="text-primary underline underline-offset-2">nodejs.org</a> → choose <strong className="text-foreground">LTS</strong> → run the <Ic>.msi</Ic> installer → click through defaults.</P>
            <P>Verify in <strong className="text-foreground">Command Prompt</strong> (Win+R → cmd):</P>
            <Code>{`node --version
npm --version`}</Code>
          </TabsContent>
          <TabsContent value="macos" className="mt-3">
            <P>Option A — Homebrew (recommended):</P>
            <Code>{`brew install node@22
node --version`}</Code>
            <P>Option B — download the <Ic>.pkg</Ic> installer from <a href="https://nodejs.org" className="text-primary underline underline-offset-2">nodejs.org</a> → LTS → run it.</P>
          </TabsContent>
          <TabsContent value="linux" className="mt-3">
            <Code>{`# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora / RHEL
sudo dnf install nodejs

# Verify
node --version   # v22.x.x`}</Code>
          </TabsContent>
        </Tabs>

        <H2>Step 2 — Install Ollama</H2>
        <Tabs defaultValue="windows" className="my-4">
          <TabsList>
            <TabsTrigger value="windows">Windows</TabsTrigger>
            <TabsTrigger value="macos">macOS</TabsTrigger>
            <TabsTrigger value="linux">Linux</TabsTrigger>
          </TabsList>
          <TabsContent value="windows" className="mt-3">
            <P>Download the Windows installer from <a href="https://ollama.ai" className="text-primary underline underline-offset-2">ollama.ai</a> → run <Ic>OllamaSetup.exe</Ic>. Ollama runs automatically as a background service after install.</P>
            <P>Verify in Command Prompt:</P>
            <Code>{`ollama --version`}</Code>
          </TabsContent>
          <TabsContent value="macos" className="mt-3">
            <P>Download the macOS app from <a href="https://ollama.ai" className="text-primary underline underline-offset-2">ollama.ai</a> → open the <Ic>.dmg</Ic> → drag Ollama to Applications. Launch it from Applications — it runs as a menu bar icon.</P>
            <Code>{`ollama --version`}</Code>
          </TabsContent>
          <TabsContent value="linux" className="mt-3">
            <Code>{`curl -fsSL https://ollama.ai/install.sh | sh

# Ollama starts automatically as a systemd service
systemctl status ollama

# Verify
ollama --version`}</Code>
          </TabsContent>
        </Tabs>

        <H2>Step 3 — Pull a model</H2>
        <P>
          Open a terminal (or Command Prompt on Windows) and choose based on your VRAM:
        </P>
        <Code>{`# bee-hover tier — ~4 GB VRAM (most gaming GPUs)
ollama pull llama3.2:3b

# bee-glide tier — ~40 GB VRAM (A100, dual RTX 3090, etc.)
ollama pull llama3.3:70b`}</Code>
        <P>
          Pull takes a few minutes. Run <Ic>ollama list</Ic> to confirm the model is ready.
        </P>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Tier</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Model</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">VRAM</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Works on</th>
              </tr>
            </thead>
            <tbody>
              {[
                { t: "bee-hover", m: "llama3.2:3b",  v: "~4 GB",  w: "RTX 3060, RTX 4060, RX 6600, Apple M1/M2" },
                { t: "bee-glide", m: "llama3.3:70b", v: "~40 GB", w: "A100, dual RTX 3090, RTX 4090 + offload" },
              ].map((r) => (
                <tr key={r.t} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs font-mono text-foreground">{r.t}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.m}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.v}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.w}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <H2>Step 4 — Get your session token</H2>
        <P>
          Go to <a href="/earn" className="text-primary underline underline-offset-2">gigabee.io/earn</a> →
          connect your Solana wallet → open the <strong className="text-foreground">Native Worker</strong> tab
          → copy your token. Keep it secret — it identifies your account.
        </P>

        <H2>Step 5 — Set up the worker</H2>
        <Tabs defaultValue="windows" className="my-4">
          <TabsList>
            <TabsTrigger value="windows">Windows</TabsTrigger>
            <TabsTrigger value="macos-linux">macOS / Linux</TabsTrigger>
          </TabsList>
          <TabsContent value="windows" className="mt-3">
            <P>Open <strong className="text-foreground">Command Prompt</strong> or <strong className="text-foreground">PowerShell</strong>:</P>
            <Code>{`mkdir gigabee-worker
cd gigabee-worker

curl -fsSL https://raw.githubusercontent.com/mr-gigabee/gigabee/main/worker/gigabee-worker.mjs -o gigabee-worker.mjs

npm init -y
npm install socket.io-client`}</Code>
          </TabsContent>
          <TabsContent value="macos-linux" className="mt-3">
            <P>Open <strong className="text-foreground">Terminal</strong>:</P>
            <Code>{`mkdir gigabee-worker && cd gigabee-worker

curl -fsSL https://raw.githubusercontent.com/mr-gigabee/gigabee/main/worker/gigabee-worker.mjs -o gigabee-worker.mjs

npm init -y
npm install socket.io-client`}</Code>
          </TabsContent>
        </Tabs>

        <H2>Step 6 — Run</H2>
        <Tabs defaultValue="windows" className="my-4">
          <TabsList>
            <TabsTrigger value="windows">Windows</TabsTrigger>
            <TabsTrigger value="macos-linux">macOS / Linux</TabsTrigger>
          </TabsList>
          <TabsContent value="windows" className="mt-3">
            <Code>{`set GIGABEE_TOKEN=your-token-here
set GIGABEE_MODELS=bee-hover
node gigabee-worker.mjs`}</Code>
          </TabsContent>
          <TabsContent value="macos-linux" className="mt-3">
            <Code>{`export GIGABEE_TOKEN=your-token-here
export GIGABEE_MODELS=bee-hover    # or bee-glide, or bee-hover,bee-glide
node gigabee-worker.mjs`}</Code>
          </TabsContent>
        </Tabs>
        <P>Expected output when connected:</P>
        <Code>{`🐝 Gigabee Worker v1.0.0
   Server : https://gigabee.io
   Ollama : http://localhost:11434
   Models : bee-hover

[gigabee] Ollama OK — 1 model(s) available
[gigabee] Warm-up: loading model into VRAM…
[gigabee] Benchmark: ~42 tok/s

[gigabee] Connected to hive — registering…
[gigabee] Registered as worker-a3f8b1c2
[gigabee] Waiting for jobs…`}</Code>
        <P>
          The worker performs a warm-up pass before benchmarking — it loads the model fully into
          VRAM so the timed run reflects real inference speed rather than model-load latency. This
          prevents the benchmark from reporting a misleadingly low speed (near 0 tok/s) on the
          first cold run.
        </P>

        <H2>Step 7 — Keep it running (optional)</H2>
        <P>Set the worker to restart automatically after reboots or crashes:</P>
        <Tabs defaultValue="linux" className="my-4">
          <TabsList>
            <TabsTrigger value="windows">Windows</TabsTrigger>
            <TabsTrigger value="macos">macOS</TabsTrigger>
            <TabsTrigger value="linux">Linux (systemd)</TabsTrigger>
            <TabsTrigger value="pm2">Any OS (pm2)</TabsTrigger>
          </TabsList>
          <TabsContent value="windows" className="mt-3">
            <P>Use <strong className="text-foreground">Task Scheduler</strong> to run the worker on login:</P>
            <Code>{`# Create a .bat launcher file in your worker folder:
# start-worker.bat
@echo off
set GIGABEE_TOKEN=your-token-here
set GIGABEE_MODELS=bee-hover
node "C:\Users\YOU\gigabee-worker\gigabee-worker.mjs"`}</Code>
            <P>Open <strong className="text-foreground">Task Scheduler</strong> → Create Basic Task → Trigger: "When I log on" → Action: Start a program → point to <Ic>start-worker.bat</Ic>.</P>
          </TabsContent>
          <TabsContent value="macos" className="mt-3">
            <P>Create a <strong className="text-foreground">launchd</strong> plist (replace paths and token):</P>
            <Code>{`# ~/Library/LaunchAgents/io.gigabee.worker.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>io.gigabee.worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/YOU/gigabee-worker/gigabee-worker.mjs</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>GIGABEE_TOKEN</key><string>your-token-here</string>
    <key>GIGABEE_MODELS</key><string>bee-hover</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>`}</Code>
            <Code>{`launchctl load ~/Library/LaunchAgents/io.gigabee.worker.plist
launchctl start io.gigabee.worker`}</Code>
          </TabsContent>
          <TabsContent value="linux" className="mt-3">
            <Code>{`# /etc/systemd/system/gigabee-worker.service
[Unit]
Description=Gigabee GPU Worker
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER/gigabee-worker
Environment=GIGABEE_TOKEN=your-token-here
Environment=GIGABEE_MODELS=bee-hover
Environment=OLLAMA_HOST=http://localhost:11434
ExecStart=/usr/bin/node gigabee-worker.mjs
Restart=always
RestartSec=15

[Install]
WantedBy=multi-user.target`}</Code>
            <Code>{`sudo systemctl daemon-reload
sudo systemctl enable --now gigabee-worker
sudo journalctl -u gigabee-worker -f`}</Code>
          </TabsContent>
          <TabsContent value="pm2" className="mt-3">
            <P><strong className="text-foreground">pm2</strong> works on Windows, macOS, and Linux — easiest cross-platform option:</P>
            <Code>{`npm install -g pm2

# Windows
set GIGABEE_TOKEN=your-token-here && set GIGABEE_MODELS=bee-hover && pm2 start gigabee-worker.mjs --name gigabee-worker

# macOS / Linux
GIGABEE_TOKEN=your-token GIGABEE_MODELS=bee-hover pm2 start gigabee-worker.mjs --name gigabee-worker

# Auto-start on boot (all OS)
pm2 save
pm2 startup    # follow the printed instruction

# View logs
pm2 logs gigabee-worker`}</Code>
          </TabsContent>
        </Tabs>

        <H2>Environment variables</H2>
        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Variable</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Default</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { v: "GIGABEE_TOKEN",  d: "(required)",             x: "Your session token from /earn" },
                { v: "GIGABEE_MODELS", d: "bee-glide",              x: "Comma-separated tier IDs: bee-hover, bee-glide" },
                { v: "GIGABEE_SERVER", d: "https://gigabee.io",     x: "Orchestrator URL — leave as default" },
                { v: "OLLAMA_HOST",    d: "http://localhost:11434",  x: "Ollama API base URL" },
              ].map((row) => (
                <tr key={row.v} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs font-mono text-foreground">{row.v}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{row.d}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.x}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <H2>Troubleshooting</H2>
        {[
          {
            problem: "Cannot reach Ollama",
            fix: "Windows: check that Ollama is running in the system tray. macOS: look for the Ollama icon in the menu bar. Linux: run 'systemctl status ollama'. Test: curl http://localhost:11434/api/tags",
          },
          {
            problem: "Auth error / invalid token",
            fix: "Copy a fresh token from gigabee.io/earn. Make sure you are logged in with the correct wallet.",
          },
          {
            problem: "Model not found",
            fix: "Run: ollama pull llama3.2:3b   (or the model shown in the warning). Then restart the worker.",
          },
          {
            problem: "GPU not being used (CPU inference only)",
            fix: "NVIDIA: run nvidia-smi during a job — GPU-Util should be > 0%. AMD: check ROCm is installed. Apple Silicon: Ollama uses Metal automatically — no extra setup needed.",
          },
          {
            problem: "Worker is slow / not getting jobs",
            fix: "The scheduler deprioritises slow workers. Ensure no other process is consuming VRAM. Close games, video editors, etc.",
          },
          {
            problem: "Worker disconnects repeatedly",
            fix: "Port 443 outbound (WSS) must be open. Check your firewall or router. Test: curl -v https://gigabee.io/api/healthz",
          },
        ].map((item) => (
          <div key={item.problem} className="p-4 rounded-xl border border-border bg-card my-3">
            <p className="text-sm font-medium text-foreground mb-1">{item.problem}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{item.fix}</p>
          </div>
        ))}
      </>
    ),
  },
  {
    id: "referrals",
    title: "Referrals",
    content: (
      <>
        <H2>Can I earn without a GPU?</H2>
        <P>
          Yes, through referrals. Chatting with Bee is a spend-side activity (you use credits, you
          don't earn them). But anyone, whether you own a GPU or not, can earn Honey by bringing
          new users to the network via their referral link. There are two distinct paths to earning:
        </P>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-sm font-medium text-foreground mb-1">GPU workers</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Serve inference jobs. Earn 75% of every job's credit value as Honey, paid in $GB on
              Solana. Requires a dedicated GPU (4 GB+ VRAM).
            </p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <p className="text-sm font-medium text-foreground mb-1">Referrers (anyone)</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Share your referral link. Earn 5% of every credit purchase made by referred users for
              12 months, capped at $100 per person. No GPU required.
            </p>
          </div>
        </div>

        <H2>Referral program</H2>
        <P>
          Share your referral link. When someone signs up through it and tops up, you earn{" "}
          <strong className="text-foreground">5% of everything they spend for 12 months</strong>,
          capped at $100 per referred user, credited as Honey.
        </P>

        <div className="border border-border rounded-xl p-5 my-4 space-y-3">
          {[
            { label: "Commission rate", value: "5% of referred user's spend" },
            { label: "Duration", value: "12 months per referee" },
            { label: "Cap per referee", value: "$100 lifetime" },
            { label: "Levels", value: "Single level only, no downline, ever" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium text-foreground">{row.value}</span>
            </div>
          ))}
        </div>

        <P>
          One level only: you earn from people you bring, never from people they bring. There is no
          "downline" here and never will be.
        </P>

        <H2>Fair-play rules</H2>
        <P>
          Self-referrals, bulk fake accounts, and paid-ads impersonation of Gigabee void the earnings
          and the account. We detect multi-accounting; don't spend effort on it.
        </P>
      </>
    ),
  },
  {
    id: "chat-features",
    title: "Chat features",
    content: (
      <>
        <P>
          The chat composer includes a set of tools that extend what you can send to Bee. Each
          button in the toolbar has a specific status, live, coming soon, or paid, described
          honestly below.
        </P>

        <H2>Attach image</H2>
        <P>
          Click the paperclip icon to attach a JPEG, PNG, or WebP image to your message. The
          image appears as a thumbnail in the composer and in your chat history. It is stored only
          in your browser session (localStorage) and is never sent to Gigabee servers.
        </P>
        <Callout title="Vision is coming soon">
          Currently the image is shown in your conversation history for context, but it is not
          forwarded to the AI model. Multimodal (vision) support requires worker-side model
          updates and will be enabled once the network supports a vision-capable model tier.
          The UI is live so you can see the intended experience.
        </Callout>

        <H2>Code mode</H2>
        <P>
          Toggle the <Ic>{"</>"}</Ic> button to switch the composer into code mode. The input
          switches to a monospace font and your message is automatically wrapped in a triple-backtick
          code fence before it is sent. This ensures the model always treats your input as code,
          which improves formatting and accuracy for debugging and code-generation tasks.
        </P>
        <Ul items={[
          "Works today, no additional credits required.",
          "Use it for pastes, stack traces, config snippets, or any freeform code.",
          "Disable it to return to normal prose mode. The fence is only added at send time.",
        ]} />

        <H2>Web search</H2>
        <Callout title="Coming soon">
          The web search button is visible in the toolbar but is disabled. When it launches,
          enabling it will allow Bee to retrieve real-time web results and cite sources within
          her answer. Pricing for search-augmented messages will be listed here when live.
        </Callout>

        <H2 id="image-generation">Image generation (18+, paid)</H2>
        <P>
          Click the <Ic>✦ Image</Ic> button in the chat composer toolbar to open the image
          generation panel. Describe what you want — Bee generates the image via Bee DAL and
          streams the result back into your conversation. The consent modal appears once; after
          that, clicking the button prefills the input directly.
        </P>

        <div className="border border-border rounded-xl overflow-x-auto my-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">Detail</th>
                <th className="px-4 py-3 text-left font-medium text-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              {[
                { k: "Status", v: "Live" },
                { k: "Cost", v: "20 credits ($0.20) per image" },
                { k: "Model", v: "Bee DAL — 1024 × 1024 px PNG" },
                { k: "Storage", v: "None — image served temporarily from Gigabee edge cache, not stored permanently" },
                { k: "Age requirement", v: "18+ — consent stored locally after first confirmation" },
              ].map((row) => (
                <tr key={row.k} className="border-b border-border/50">
                  <td className="px-4 py-3 text-xs font-medium text-foreground">{row.k}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{row.v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div id="content-policy" className="mt-6">
          <H3>Content policy</H3>
          <P>
            Gigabee operates an uncensored image generation tier. By enabling this feature you
            confirm that you are at least 18 years of age and that your use complies with all
            laws applicable in your jurisdiction. You must not generate:
          </P>
          <Ul items={[
            "Any sexual content depicting minors (illegal everywhere; results in immediate permanent ban and referral to law enforcement).",
            "Content that is illegal under the laws of your country of residence.",
            "Content used to harass, defame, or threaten a real, identifiable person.",
          ]} />
          <P>
            Gigabee does not pre-screen or store generated images. Violations discovered through
            integrity checks, reports, or legal process result in immediate account suspension and
            forfeiture of any pending earnings or credits. We cooperate fully with law enforcement.
          </P>
        </div>
      </>
    ),
  },
  {
    id: "api",
    title: "API reference",
    content: (
      <>
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live — available now
          </span>
        </div>
        <P>
          Gigabee exposes an OpenAI-compatible REST API at{" "}
          <Ic>https://gigabee.io/api/v1</Ic>. Point any OpenAI SDK or agent framework at
          this base URL, set your API key, and it works without any other code changes.
          Generate an API key in <a href="/earn" className="text-primary underline underline-offset-2">Earn → API Keys</a>.
        </P>

        <div className="border border-border rounded-xl p-4 my-4 space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-16 shrink-0">Base URL</span>
            <Ic>https://gigabee.io/api/v1</Ic>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-16 shrink-0">Auth</span>
            <Ic>Authorization: Bearer giga_...</Ic>
            <span className="text-muted-foreground text-xs">(create keys in Earn → API Keys)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-16 shrink-0">Models</span>
            <div className="flex gap-2">
              <Ic>bee-hover</Ic>
              <Ic>bee-glide</Ic>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground w-16 shrink-0">Streaming</span>
            <Ic>{"\"stream\": true"}</Ic>
            <span className="text-muted-foreground text-xs">SSE, OpenAI-compatible chunk format</span>
          </div>
        </div>

        <H2>Endpoints</H2>
        <Code>{`GET  /api/v1/models
POST /api/v1/chat/completions`}</Code>

        <H2>Non-streaming example</H2>
        <Code>{`curl https://gigabee.io/api/v1/chat/completions \\
  -H "Authorization: Bearer giga_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "bee-glide",
    "messages": [{"role": "user", "content": "Hello, Bee!"}]
  }'`}</Code>

        <H2>Streaming example</H2>
        <Code>{`curl https://gigabee.io/api/v1/chat/completions \\
  -H "Authorization: Bearer giga_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "bee-hover",
    "messages": [{"role": "user", "content": "Count to 5 slowly."}],
    "stream": true
  }'`}</Code>

        <H2>API key management</H2>
        <P>
          Create, list, and revoke API keys from the{" "}
          <a href="/earn" className="text-primary underline underline-offset-2">Earn → API Keys</a>{" "}
          tab. Keys start with <Ic>giga_</Ic> and are shown once on creation. Up to 10 active keys
          per account. Revocation takes effect immediately.
        </P>

        <H2>Pricing</H2>
        <P>
          Same as chat: 10 credits ($0.10) for Bee Hover, 15 credits ($0.15) for Bee Glide.
          Credits are deducted per request regardless of token count.
        </P>
      </>
    ),
  },
  {
    id: "agent-frameworks",
    title: "Agent frameworks",
    content: (
      <>
        <P>
          Gigabee exposes an OpenAI-compatible API at <Ic>https://gigabee.io/api/v1</Ic>. Any
          agent framework that accepts a custom base URL and API key works out of the box — no
          wrappers, no plugins, no code changes beyond two config lines. The examples below show
          how to plug Gigabee into three popular frameworks.
        </P>

        <Callout title="API keys">
          Create API keys from the{" "}
          <a href="/earn" className="text-primary underline underline-offset-2">
            Earn → API Keys
          </a>{" "}
          tab. Keys start with <Ic>giga_</Ic> and are shown once on creation.
          1 credit = $0.01, same pricing as chat.
        </Callout>

        <H3>Hermes Agent (Nous Research)</H3>
        <P>
          Hermes is a CLI-first autonomous agent by NousResearch. It uses an OpenAI-compatible
          endpoint via <Ic>base_url</Ic> and <Ic>api_key</Ic> in its config. Two options below: CLI
          config or the Python SDK.
        </P>
        <P>
          <strong>Option A — CLI config</strong> (recommended, no code required):
        </P>
        <Code>{`pip install hermes-agent

hermes config set base_url https://gigabee.io/api/v1
hermes config set api_key giga_your_key_here
hermes config set model bee-glide

hermes run "Research the latest papers on mixture-of-experts and summarise."`}</Code>
        <P>
          <strong>Option B — Python SDK</strong> (for use inside your own agent code):
        </P>
        <Code>{`from agents import Agent, Runner, OpenAIChatCompletionsModel
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="https://gigabee.io/api/v1",
    api_key="giga_your_key_here",
)

agent = Agent(
    name="Bee",
    instructions="You are a helpful assistant powered by Gigabee.",
    model=OpenAIChatCompletionsModel(
        model="bee-glide",
        openai_client=client,
    ),
)

result = Runner.run_sync(agent, "Explain decentralized inference in one paragraph.")
print(result.final_output)`}</Code>

        <H3>LangChain</H3>
        <P>
          Pass <Ic>base_url</Ic> and <Ic>api_key</Ic> to <Ic>ChatOpenAI</Ic>. Every LangChain
          chain, tool, and agent that works with <Ic>ChatOpenAI</Ic> works with Gigabee unchanged.
        </P>
        <Code>{`from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="bee-glide",
    base_url="https://gigabee.io/api/v1",
    api_key="YOUR_GIGABEE_API_KEY",
)

response = llm.invoke("What is Gigabee?")
print(response.content)`}</Code>

        <H3>Vercel AI SDK</H3>
        <P>
          Use the <Ic>@ai-sdk/openai</Ic> provider's <Ic>createOpenAI</Ic> factory to point the
          SDK at Gigabee. Works with <Ic>generateText</Ic>, <Ic>streamText</Ic>, and the RSC
          helpers.
        </P>
        <Code>{`import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

const gigabee = createOpenAI({
  baseURL: "https://gigabee.io/api/v1",
  apiKey: "YOUR_GIGABEE_API_KEY",
});

const { text } = await generateText({
  model: gigabee("bee-glide"),
  prompt: "Explain decentralized inference in one paragraph.",
});

console.log(text);`}</Code>
      </>
    ),
  },
  {
    id: "roadmap",
    title: "Roadmap & the honesty page",
    content: (
      <>
        <H2>Live now</H2>
        <Ul items={[
          "Bee Hover & Glide chat — routes to native Ollama GPU workers when online, falls back to OpenRouter free models",
          "Phantom & Solflare wallet login (no password, no email, no KYC)",
          "Credits system: 1 credit = $0.01, 10 free on signup",
          "$GB credit top-up via Phantom/Solflare (Solana mainnet, verified on-chain before credits are issued)",
          "Native GPU worker script (Node.js + Ollama) — connect your GPU, jobs route to you when you're online",
          "Real-time worker monitor panel on /earn — shows live online/offline status, polling every 5 seconds",
          "Earnings recorded to database per job — pending balance and history visible on /earn",
          "Earnings scheduler — pending Honey automatically matures to available status after 24 hours",
          "$GB Honey withdrawals to any Solana wallet — submit a withdrawal request from /earn",
          "Referral program: share your link, earn 5% of what referrals spend for 12 months",
          "Public OpenAI-compatible API (GET /api/v1/models, POST /api/v1/chat/completions) with SSE streaming",
          "API key management: create/revoke giga_ keys from Earn → API Keys, authenticate any OpenAI SDK client",
          "Chat composer: image attachment UI (vision model forwarding coming soon)",
          "Chat composer: code mode, auto-wraps input in code fences at send time",
          "Image generation via Bee DAL (18+, age-gated, 20 credits per image) — click ✦ Image in chat",
          "Browser GPU workers (WebGPU, no install) — open /earn → Browser Worker tab, no CLI required",
          "Real GPU throughput benchmark — browser workers measure actual tok/s before joining the hive; speed shown live on earn panel",
          "Conversation affinity routing — follow-up turns in the same conversation prefer the same GPU for KV-cache reuse",
          "Canary quality probes — ~2% of jobs trigger a silent shadow check; worker reputation updates automatically based on answer quality",
          "Model hash verification — workers can supply a model weight hash at registration; verified hashes receive a reputation boost",
          "Reputation decay — idle worker reputation drifts back to neutral (0.5) after 1 hour of inactivity",
          "HMAC-signed earning receipts — GET /api/earnings/receipts returns cryptographically signed proofs of each earning entry",
          "Download watchdog — browser workers surface a clear error if the model download stalls for more than 90 seconds",
        ]} />

        <H2>Building next (in order)</H2>
        <Ul items={[
          "Automated payout approval (currently reviewed manually before on-chain transfer)",
          "Vision model tier, enables image attachment to be forwarded to the model",
          "Web search augmentation for Bee (cite real-time sources in answers)",
          "Mirror checks: a fraction of real jobs run on two workers and outputs are compared",
          "Staking: 85% worker rate + revenue share",
          "Bee Soar: multi-GPU flagship tier",
          "Public /data stats page (jobs/day, Honey paid, payout hashes)",
        ]} />

        <H2>Never promised</H2>
        <P>
          Token launches, fixed yields, guaranteed APY, price predictions. If you see any of those
          next to our name, it's a scam. Report it at{" "}
          <a href="mailto:security@gigabee.io" className="text-primary underline underline-offset-2">
            security@gigabee.io
          </a>.
        </P>

        <Callout title="We say what's real">
          Every section of this docs page is updated to reflect only what's actually built. When
          something says "coming soon", that means the code doesn't exist yet, not that it's
          "almost done." We'd rather under-promise than mislead you.
        </Callout>
      </>
    ),
  },
  {
    id: "changelog",
    title: "Changelog",
    content: (
      <>
        <P>
          A technical record of every meaningful change shipped to the Gigabee network. Most recent
          first. Changes that affect worker behaviour, earnings, or the withdrawal flow are marked.
        </P>

        {[
          {
            version: "v1.5.0",
            date: "July 2026",
            tag: "Quality · Routing · Security",
            changes: [
              {
                title: "New: Canary quality probes",
                detail:
                  "After approximately 2% of completed jobs, the orchestrator silently dispatches a shadow job to the same worker using a known question-answer pair (e.g. 'What is 17 + 25?'). The result is never shown to any user — only the keyword match updates the worker's reputation score (+0.05 for a correct answer, −0.10 for a wrong one). Canary jobs are never billed, never written to the database, and are invisible to the worker receiving them.",
              },
              {
                title: "New: Conversation affinity routing",
                detail:
                  "The orchestrator now tracks a conversationId → workerSocketId mapping. When a client sends follow-up turns in the same conversation, the scheduler prefers the worker that handled the first turn. This keeps the model's key-value cache warm and reduces first-token latency on multi-turn conversations. Affinity is automatically cleared if the worker disconnects.",
              },
              {
                title: "New: Model hash verification on worker registration",
                detail:
                  "Workers can optionally supply a modelHash field when registering. The orchestrator checks it against a table of known expected hashes (KNOWN_MODEL_HASHES). A verified match boosts starting reputation to 0.6; a mismatch drops it to 0.4; absent hash starts at the default 0.5. This lets the network prefer workers running unmodified, trusted model weights.",
              },
              {
                title: "New: Reputation decay for idle workers",
                detail:
                  "A background interval runs every 10 minutes. Any worker that has been idle for more than 1 hour and has a reputation above or below 0.5 has its score stepped 0.02 toward neutral. This prevents stale high (or low) reputation scores from permanently affecting dispatch probability for workers that stop serving jobs.",
              },
              {
                title: "New: HMAC-signed earning receipts",
                detail:
                  "GET /api/earnings/receipts returns up to 100 most-recent earning entries, each accompanied by an HMAC-SHA256 signature (key: SESSION_SECRET). Workers can call verifyEarningReceipt() with the receipt payload to independently confirm that a given earning record is authentic and unmodified — without trusting the server's balance display.",
              },
              {
                title: "New: Browser worker GPU speed shown live",
                detail:
                  "During job processing, the earn panel now displays a live Speed stat (tok/s) updated every 5 tokens. The static 'Model: Bee Nano' stat card was replaced with 'Speed: X tok/s' — showing '—' when idle. The GPU throughput benchmark now uses a distinct 'Benchmarking GPU…' status with its own panel, distinct from the model loading step.",
              },
              {
                title: "New: Download watchdog for browser workers",
                detail:
                  "A 90-second timeout fires if no download progress event arrives after the browser worker begins fetching the model (~400 MB). The watchdog surfaces a human-readable error message and resets the worker state instead of hanging silently. The timer is cleared as soon as the model finishes loading into GPU memory.",
              },
            ],
          },
          {
            version: "v1.4.0",
            date: "July 2026",
            tag: "Image Generation · Browser GPU",
            changes: [
              {
                title: "New: Bee DAL — image generation live",
                detail:
                  "Image generation is now live for all users. Click ✦ Image in the chat composer, describe what you want, and Bee DAL renders a 1024 × 1024 PNG directly in your conversation. Cost: 20 credits ($0.20) per image. Images are served from a temporary in-memory edge cache and are never stored permanently on Gigabee servers. An age-gated consent modal appears once; subsequent clicks prefill the prompt directly.",
              },
              {
                title: "New: Browser GPU workers (WebGPU, no install)",
                detail:
                  "WebGPU browser workers are live. Open /earn → Browser Worker tab in Chrome or Edge, click Start Worker, and keep the tab open. Your GPU serves inference jobs from the browser and earns Honey ($GB) per job — the same 75% revenue share as native Ollama workers. No installation, no CLI, no GPU driver setup required beyond a WebGPU-capable browser.",
              },
            ],
          },
          {
            version: "v1.3.0",
            date: "July 2026",
            tag: "Earnings · Workers · Infrastructure",
            changes: [
              {
                title: "Fix: earnings now correctly recorded per job",
                detail:
                  "A critical bug caused finishJob() to write workerId: undefined to the earnings ledger, so no earnings were ever stored for real workers. The fix resolves the worker's database UUID from the in-memory orchestrator map (setWorkerDbId, called at registration time) and passes it to recordJobCompletion(). Earnings are now correctly attributed to the worker that served the job.",
              },
              {
                title: "Fix: benchmark warm-up pass prevents ~0 tok/s readings",
                detail:
                  "The worker script now performs a warm-up inference pass before the timed benchmark run. Without the warm-up, the model had to load into VRAM during the benchmark, causing artificially low (often near-zero) speed readings. After the warm-up, the model is already resident in VRAM and the timed pass reflects real inference throughput. Speed is floored at 1 tok/s to avoid divides-by-zero in the scheduler.",
              },
              {
                title: "New: real-time worker monitor panel",
                detail:
                  "The Earn page → Native Worker tab now shows a live worker status panel. It uses Socket.io to subscribe to the /hive namespace and polls the REST API every 5 seconds. The panel displays: online / offline state with a colour dot, session duration, and all-time job count. Previously the panel always showed 'No worker registered yet' because hive.ts never wrote to the database on registration. Both bugs are now fixed: hive.ts upserts to workersTable on worker:register and updates lastSeenAt on worker:heartbeat.",
              },
              {
                title: "New: earnings scheduler (pending → available)",
                detail:
                  "A background scheduler runs every 5 minutes inside the API server process. It queries earningsLedgerTable for rows where status = 'pending' and availableAt ≤ NOW(), then bulk-updates them to status = 'available'. This is the mechanism that makes earnings spendable after the 24-hour integrity hold. Without this scheduler, the available balance in the withdrawal UI would always read $0.00 regardless of how many jobs were completed.",
              },
              {
                title: "New: worker DB registration linked to orchestrator",
                detail:
                  "When a worker connects and authenticates via Socket.io, hive.ts upserts a row in workersTable (keyed by userId + models), retrieves the database UUID, and calls orchestrator.setWorkerDbId(socketId, dbWorkerId) to store it in the in-memory InMemoryWorker record. This link is what allows finishJob() to look up the correct DB ID when recording earnings.",
              },
              {
                title: "Fix: worker status enum alignment",
                detail:
                  "hive.ts was emitting status: 'online' which did not match the WorkerStatus enum values ('idle', 'serving', 'offline'). The monitor panel was silently receiving an unrecognized value and displaying incorrect state. Fixed to emit 'idle' when connected and waiting, 'serving' when processing a job, and to use the enum throughout.",
              },
              {
                title: "Fix: landing page worker count always 0",
                detail:
                  "The /api/stats REST endpoint was querying workersTable (database rows) for the online worker count. But active workers are tracked in the orchestrator's in-memory map, not in the DB, so the count was always 0 even with workers connected. Fixed: getOnlineWorkerCount() now reads from the orchestrator map. The landing page also subscribes to the public /stats Socket.io namespace for push updates, supplemented by REST polling every 5 seconds.",
              },
            ],
          },
          {
            version: "v1.2.0",
            date: "June 2026",
            tag: "Auth · Chat · Credits",
            changes: [
              {
                title: "Embedded wallet auth",
                detail:
                  "Replaced magic-link email auth with embedded wallet sign-in. Users connect with Phantom or Solflare. Sessions are stored as Bearer tokens in the database. Auth header: Authorization: Bearer <token>. No cookies.",
              },
              {
                title: "Credit top-up via Solana on-chain verification",
                detail:
                  "Users can top up credits by sending $GB on Solana mainnet. The server watches for the transaction, verifies it on-chain, and issues credits atomically. 1 credit = $0.01.",
              },
              {
                title: "Token streaming from native workers",
                detail:
                  "When a native Ollama worker is online, the orchestrator routes the job to it and streams tokens back to the browser via Socket.io. The chat page renders tokens word-by-word with a typewriter effect.",
              },
            ],
          },
          {
            version: "v1.1.0",
            date: "May 2026",
            tag: "Workers · Earnings",
            changes: [
              {
                title: "Native worker script (gigabee-worker.mjs)",
                detail:
                  "First public release of the standalone Node.js worker. Workers connect to the hive via Socket.io, receive jobs, run inference with Ollama, and stream tokens back. Earnings are tracked per job at 75% of the credit value charged.",
              },
              {
                title: "Referral program",
                detail:
                  "Referrers earn 5% of referee credit purchases for 12 months, capped at $100 per referred user. Referral attribution uses a link code stored at registration.",
              },
            ],
          },
        ].map((release) => (
          <div key={release.version} className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-base font-semibold text-foreground">{release.version}</span>
              <span className="text-muted-foreground text-sm">{release.date}</span>
              <Badge variant="outline" className="text-xs">{release.tag}</Badge>
            </div>
            <div className="space-y-3">
              {release.changes.map((c) => (
                <div key={c.title} className="p-4 rounded-xl border border-border bg-card/50">
                  <p className="text-sm font-medium text-foreground mb-1">{c.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </>
    ),
  },
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState("what-is-gigabee");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Navigate to the section specified in the URL hash (e.g. /docs#worker-setup)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && sections.some((s) => s.id === hash)) {
      setActiveSection(hash);
    }
  }, []);

  const active = sections.find((s) => s.id === activeSection)!;
  const activeIdx = sections.findIndex((s) => s.id === activeSection);
  const nextSection = sections[activeIdx + 1];

  return (
    <div className="min-h-screen bg-background flex" data-testid="docs-page">
      {/* Sidebar */}
      <aside
        className={`
        ${mobileNavOpen ? "fixed inset-0 z-50 flex flex-col" : "hidden"}
        md:flex md:w-64 md:static md:flex-shrink-0
        border-r border-border bg-card flex-col
      `}
      >
        {mobileNavOpen && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="font-medium">Docs</span>
            <button onClick={() => setMobileNavOpen(false)}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="p-4 border-b border-border hidden md:flex items-center gap-2">
          <Link href="/">
            <div className="flex items-center gap-2 hover:text-primary transition-colors">
              <BeeLogo className="h-5 w-5" />
              <span className="font-medium text-sm">Gigabee</span>
            </div>
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm text-muted-foreground">Docs</span>
        </div>

        <ScrollArea className="flex-1 p-3">
          <nav className="space-y-0.5">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === section.id
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
                data-testid={`docs-nav-${section.id}`}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-border space-y-1">
          <Link href="/">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground">
              <Home className="h-3.5 w-3.5" />Home
            </Button>
          </Link>
          <Link href="/chat">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />Chat
            </Button>
          </Link>
          <Link href="/earn">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground">
              <Coins className="h-3.5 w-3.5" />Earn
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Mobile nav bar */}
        <div className="md:hidden flex items-center gap-3 p-4 border-b border-border sticky top-0 bg-background z-40">
          <button onClick={() => setMobileNavOpen(true)} data-testid="btn-mobile-docs-nav">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <span className="text-sm font-medium">{active.title}</span>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-10">
          <Badge variant="secondary" className="mb-4 text-xs">Documentation</Badge>
          <h1 className="text-3xl font-medium text-foreground mb-8">{active.title}</h1>

          <div className="prose-sm">{active.content}</div>

          {/* Next section link */}
          {nextSection && (
            <div className="mt-12 pt-6 border-t border-border">
              <button
                onClick={() => setActiveSection(nextSection.id)}
                className="flex items-center justify-between w-full p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors group"
                data-testid="btn-docs-next"
              >
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Next</p>
                  <p className="text-sm font-medium text-foreground">{nextSection.title}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
