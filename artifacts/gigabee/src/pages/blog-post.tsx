import { Link, useParams } from "wouter";
import { BeeLogo } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BLOG_POSTS, formatDate } from "@/data/blog-posts";
import NotFound from "@/pages/not-found";
import { getSessionToken } from "@/lib/socket";

// ---------------------------------------------------------------------------
// Shared prose helpers
// ---------------------------------------------------------------------------

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground leading-relaxed mb-5">
      {children}
    </p>
  );
}
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold text-foreground mt-10 mb-3 first:mt-0">
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-medium text-foreground mt-7 mb-2">
      {children}
    </h3>
  );
}
function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="text-sm text-muted-foreground space-y-2 mb-5 list-none pl-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-primary mt-0.5 shrink-0">›</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-sm text-muted-foreground leading-relaxed">
      {children}
    </div>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-5">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border pb-2 pr-6 last:pr-0"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="py-2.5 pr-6 last:pr-0 text-sm text-muted-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post content map
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  Infrastructure: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "How-to": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Earning: "bg-primary/10 text-primary border-primary/20",
  Privacy: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  Updates: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  Integration: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
};

const CONTENT: Record<string, React.ReactNode> = {
  // -------------------------------------------------------------------------
  "how-gigabee-decentralized-ai-infrastructure-works": (
    <>
      <P>
        Most AI products today are built on massive, centralized data centers owned by a handful of companies. Every prompt you send travels to a server farm, where it is logged, processed, and returned, along with metadata about who sent it, when, and from where. Gigabee takes the opposite approach: every inference job is served by an independently operated GPU, anywhere in the world.
      </P>
      <P>
        This post is a technical breakdown of how that works in practice, from the moment you press Enter in the chat interface to the moment the first token appears on your screen.
      </P>

      <H2>The three layers: Users, Orchestrator, Workers</H2>
      <P>
        Gigabee's architecture has three distinct layers. Users interact with the chat interface at gigabee.io/chat. An orchestrator service (running on a dedicated server) handles routing and billing. Workers, either browser tabs using WebGPU or native daemons running Ollama, serve the actual inference.
      </P>
      <Ul
        items={[
          "Users send a prompt. The frontend opens a Socket.io connection, deducts a credit hold, and submits the job.",
          "The orchestrator receives the job, selects an available worker based on model support, latency, and worker stake, then forwards the request.",
          "The worker runs inference and streams tokens back through the orchestrator to the user's browser in real time.",
          "When the job completes, the orchestrator finalises the credit deduction and queues the worker's earnings.",
        ]}
      />

      <H2>The two AI models: Bee Hover and Bee Glide</H2>
      <P>
        Gigabee currently exposes two model tiers, both fine-tuned for helpful, context-aware conversation:
      </P>
      <Table
        headers={["Model", "Cost", "Best for"]}
        rows={[
          ["Bee Hover", "10 credits ($0.10)", "Fast responses, lighter tasks, general Q&A"],
          ["Bee Glide", "15 credits ($0.15)", "Longer reasoning, code generation, detailed analysis"],
        ]}
      />
      <P>
        Model identifiers are pinned in the orchestrator's constants and validated server-side on every job request, so clients cannot downgrade to a cheaper model after job dispatch.
      </P>

      <H2>Worker selection</H2>
      <P>
        When the orchestrator receives a job, it queries a live index of connected workers. Selection criteria (in priority order):
      </P>
      <Ul
        items={[
          "Model availability, the worker must have the requested model loaded.",
          "Current load, workers already serving a job are deprioritised to reduce queuing latency.",
          "Stake (Phase 2), workers who have staked $GB earn a higher revenue share and are preferred for job assignment, creating a quality incentive.",
          "Geographic proximity, lower round-trip latency means faster first-token time for the user.",
        ]}
      />
      <Note>
        Worker selection is deterministic given the same inputs. The orchestrator does not expose which specific worker served a job to the end user, protecting both worker privacy and the job routing strategy.
      </Note>

      <H2>Token streaming via Socket.io</H2>
      <P>
        Gigabee uses Socket.io (on top of WebSockets) for real-time bidirectional communication. When a worker begins generating tokens, it emits a <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">job:token</code> event for each chunk. The orchestrator relays this immediately to the user's socket connection, producing the typewriter effect you see in the chat interface.
      </P>
      <P>
        On connection loss, the client reconnects and resumes the stream from where it left off if the job is still active. This makes the experience resilient to brief network interruptions without restarting inference.
      </P>

      <H2>The Solana payment rail</H2>
      <P>
        All money flows in Gigabee settle on Solana mainnet using $GB (CA: 7NcMKMrXPBVCWPcs9SSqnF6ZGy5neAtzTZpFqZqLquaP). There are two flows:
      </P>
      <Ul
        items={[
          "Deposits: Users send $GB to the Gigabee treasury wallet. The frontend builds a transferChecked SPL token transaction, the user approves it in Phantom or Solflare, and the backend verifies the on-chain transaction before crediting the account.",
          "Withdrawals: Workers accumulate Honey earnings in an internal ledger. When they request a payout, the treasury signs and broadcasts a $GB transfer to the worker's wallet. The transaction hash is recorded and linked from the earnings dashboard.",
        ]}
      />
      <P>
        Because every payment is a standard on-chain $GB transfer, both users and workers can independently verify all flows on Solscan, there is no closed ledger to trust.
      </P>

      <H2>No central GPU dependency</H2>
      <P>
        The orchestrator itself does not run inference. It is a stateless routing and billing service. If every current worker went offline, the orchestrator would queue jobs and serve them as workers reconnect, nothing needs to be redeployed or scaled up. Adding capacity is as simple as another person opening gigabee.io/earn in a WebGPU-capable browser, anywhere in the world.
      </P>
      <P>
        This design means Gigabee's inference capacity scales with its contributor community, not with our infrastructure budget. It also means there is no single point of failure for serving AI, a DDoS attack on a single data center cannot take the entire network down.
      </P>

      <H2>What comes next</H2>
      <Ul
        items={[
          "Worker staking (Phase 2): Workers lock $GB to earn an 85% revenue share (up from 75%) and gain priority in job assignment.",
          "Image generation: Open-source diffusion models served by verified GPU workers, with age verification enforced at job dispatch.",
          "Worker reputation: On-chain reputation scoring based on job completion rate, latency, and evaluator ratings.",
          "Additional model tiers: Larger, more capable models for specialised tasks, with dynamic pricing based on compute cost.",
        ]}
      />
    </>
  ),

  // -------------------------------------------------------------------------
  "how-to-set-up-gigabee-worker-earn-usdc": (
    <>
      <P>
        Running a Gigabee worker lets you earn $GB by serving AI inference jobs to users around the world. Your GPU does the work; the Gigabee network handles routing, billing, and payment. This guide covers both worker types, browser-based (WebGPU) and native (Ollama), from first login to first payout.
      </P>
      <Note>
        You do not need to buy credits or pay anything to become a worker. You only need a Solana wallet and a capable GPU.
      </Note>

      <H2>Step 1: Create your account</H2>
      <P>
        Gigabee uses wallet-based authentication, no email or password required.
      </P>
      <Ul
        items={[
          "Install Phantom (phantom.app) or Solflare (solflare.com) as a browser extension.",
          "Go to gigabee.io/login and click Connect Solana Wallet.",
          "Your wallet will ask you to sign a short message, this proves you own the wallet address without any on-chain transaction or gas fee.",
          "You are now signed in. Your wallet address becomes your account identifier.",
        ]}
      />

      <H2>Step 2a: Browser worker (WebGPU)</H2>
      <P>
        The easiest way to start is directly in your browser using the WebGPU API, which gives web applications access to your local GPU.
      </P>
      <H3>Requirements</H3>
      <Ul
        items={[
          "Chrome 113+ or Edge 113+ (Firefox does not support WebGPU yet).",
          "A dedicated GPU, integrated graphics will work for some models but performance will be limited.",
          "The page must remain open and active while you are serving jobs.",
        ]}
      />
      <H3>Setup</H3>
      <Ul
        items={[
          "Go to gigabee.io/earn and open the Browser Worker tab.",
          "Click Start Browser Worker. The model will be downloaded to your browser's cache on first run (typically 1-4 GB depending on the model tier).",
          "Once the status shows Active, your worker is registered in the orchestrator and will begin receiving jobs.",
          "You can watch the job count and earnings accumulate in real time on the same screen.",
        ]}
      />

      <H2>Step 2b: Native worker (Ollama)</H2>
      <P>
        For unattended, full-time earning, the native worker mode runs as a background daemon on your machine using Ollama, an open-source local model runtime.
      </P>
      <H3>Requirements</H3>
      <Ul
        items={[
          "A machine you can leave running, a desktop with a dedicated GPU is ideal.",
          "At least 8 GB VRAM for Bee Hover, 16 GB for Bee Glide.",
          "Ollama installed (ollama.com/download, available for macOS, Linux, and Windows).",
        ]}
      />
      <H3>Setup</H3>
      <Ul
        items={[
          "Install Ollama from ollama.com and verify it works: run ollama run llama3 in your terminal.",
          "Pull the Gigabee model: ollama pull bee-hover (or bee-glide for the higher-tier model).",
          "Go to gigabee.io/earn and open the Native Worker tab.",
          "Copy your API key from the dashboard.",
          "Start the Gigabee worker daemon: gigabee-worker --api-key YOUR_KEY --model bee-hover",
          "The daemon connects to the orchestrator over a persistent WebSocket. Job assignments arrive automatically.",
        ]}
      />
      <Note>
        The native worker runs fully locally. Your machine serves inference; the Gigabee orchestrator only sends job payloads and receives token outputs. No model weights leave your machine.
      </Note>

      <H2>Step 3: Monitor your earnings</H2>
      <P>
        The /earn page shows a live dashboard with:
      </P>
      <Ul
        items={[
          "Total Honey earned (in $GB equivalent)",
          "Jobs completed today and this week",
          "Current worker status (Active / Idle / Offline)",
          "Pending payout balance and hold-until date",
        ]}
      />
      <P>
        Earnings are credited to your internal ledger after each confirmed job. The ledger updates in real time while your worker is active.
      </P>

      <H2>Step 4: Withdraw your $GB</H2>
      <P>
        When your balance reaches the minimum payout threshold, you can request a withdrawal.
      </P>
      <Ul
        items={[
          "Go to gigabee.io/earn and click Request Withdrawal.",
          "Enter your Solana wallet address (the one you signed in with, or any wallet you control).",
          "The payout is queued for admin review and sent to your wallet via an on-chain $GB transfer.",
          "Once sent, a Solscan link appears in your payout history so you can verify the transaction independently.",
        ]}
      />
      <Table
        headers={["Payout detail", "Value"]}
        rows={[
          ["Minimum withdrawal", "$25.00 in $GB"],
          ["Payment token", "$GB on Solana mainnet"],
          ["Processing time", "Typically within 24 hours"],
          ["Verification", "On-chain, visible on Solscan"],
        ]}
      />

      <H2>Step 5: Grow your earnings with referrals</H2>
      <P>
        Share your referral link from the /earn page. When someone signs up using your link, you earn a percentage of their credit spend indefinitely, with no cap. This compounds over time as your referrals bring in more users.
      </P>

      <H2>Common questions</H2>
      <H3>Can I run multiple workers?</H3>
      <P>
        Yes. You can run both a browser worker and a native worker simultaneously from the same account. They will each receive independent job assignments and accumulate earnings separately.
      </P>
      <H3>What if my machine goes offline mid-job?</H3>
      <P>
        The orchestrator detects the disconnection and re-routes the job to another available worker within seconds. You are not penalised for disconnection, but consistent availability improves your worker reputation score over time.
      </P>
    </>
  ),

  // -------------------------------------------------------------------------
  "gigabee-worker-earnings-guide-honey-rewards": (
    <>
      <P>
        Before committing GPU time to Gigabee, the most common question is: what will I actually earn? This guide answers that with real numbers, the exact payout formula, a breakdown of both model tiers, and a look at additional income streams beyond base inference jobs.
      </P>

      <H2>The Honey formula</H2>
      <P>
        Every job you serve earns a share of the credits the user spent. The formula is straightforward:
      </P>
      <div className="my-5 rounded-xl border border-border bg-card px-5 py-4 font-mono text-sm text-foreground">
        earnings = credits × $0.01 × revenue_share
      </div>
      <P>
        Revenue share is 75% at standard rate. Workers who stake $GB (Phase 2, coming soon) earn 85%.
      </P>
      <Table
        headers={["Model", "User cost", "Your earnings (75%)", "Your earnings (85% staked)"]}
        rows={[
          ["Bee Hover", "10 credits / $0.10", "$0.075 per job", "$0.085 per job"],
          ["Bee Glide", "15 credits / $0.15", "$0.1125 per job", "$0.1275 per job"],
        ]}
      />
      <Note>
        The remaining 25% (or 15% staked) goes to the Gigabee treasury to cover orchestrator infrastructure, referral payouts, and evaluator rewards.
      </Note>

      <H2>Estimating hourly and daily earnings</H2>
      <P>
        Actual earnings depend on how many jobs per hour your GPU can serve. Faster GPUs complete jobs more quickly, becoming available for the next job sooner. Here is a realistic range based on common consumer GPUs:
      </P>
      <Table
        headers={["GPU", "Approx. jobs/hour", "Daily earnings (Bee Hover, 75%)", "Monthly earnings"]}
        rows={[
          ["RTX 3060 (12 GB)", "18-25", "$1.35 - $1.88", "$40 - $56"],
          ["RTX 3080 (10 GB)", "28-38", "$2.10 - $2.85", "$63 - $86"],
          ["RTX 4070 (12 GB)", "35-50", "$2.63 - $3.75", "$79 - $113"],
          ["RTX 4090 (24 GB)", "55-80", "$4.13 - $6.00", "$124 - $180"],
          ["Apple M3 Pro", "20-30", "$1.50 - $2.25", "$45 - $68"],
        ]}
      />
      <P>
        These estimates assume your worker is active 24 hours a day and that the network is delivering consistent job volume. Early in the network's growth, job supply may be lower, earnings scale with the user base.
      </P>

      <H2>Bee Glide multiplier</H2>
      <P>
        If your GPU has enough VRAM to serve Bee Glide (16 GB+), you earn 50% more per job compared to Bee Hover. A GPU handling 30 Bee Glide jobs per hour earns $0.1125 × 30 = $3.375 per hour vs $0.075 × 30 = $2.25 for Bee Hover, the same GPU, 50% more revenue.
      </P>

      <H2>Additional income streams</H2>
      <H3>Referral rewards</H3>
      <P>
        Share your referral link from the /earn page. You earn a percentage of the credit spend of everyone who signs up through your link, indefinitely and with no cap. High-quality referrals (users who become regular chatters) compound over months.
      </P>
      <H3>Evaluator rewards</H3>
      <P>
        Gigabee uses human evaluators to rate AI output quality. If you opt in as an evaluator, you earn additional credits for each rating session. This requires no GPU, just your time and judgment.
      </P>
      <H3>Creator rewards (Phase 2)</H3>
      <P>
        Building tools, prompts, or workflows that drive Gigabee usage will be eligible for creator rewards. Details will be published when the creator program launches.
      </P>

      <H2>Staking for higher revenue share</H2>
      <P>
        In Phase 2, workers will be able to stake $GB to signal commitment to the network. Staked workers receive 85% revenue share (vs 75%) and are prioritised in job assignment, meaning more jobs per hour on top of more earnings per job. The two effects compound significantly at scale.
      </P>
      <Table
        headers={["Mode", "Revenue share", "Job priority", "RTX 4070 monthly (Bee Hover)"]}
        rows={[
          ["Standard", "75%", "Normal", "~$79 - $113"],
          ["Staked (Phase 2)", "85%", "High", "~$90 - $128"],
        ]}
      />

      <H2>Withdrawal and taxes</H2>
      <P>
        Earnings are paid in $GB on Solana mainnet. Each payout is a publicly verifiable on-chain transaction. The $GB value in USD terms depends on the live market price.
      </P>
      <P>
        Tax treatment of cryptocurrency earnings varies by country. In most jurisdictions, token income received from services rendered is treated as ordinary income at the time of receipt. Consult a tax professional for advice specific to your situation.
      </P>
    </>
  ),

  // -------------------------------------------------------------------------
  "is-gigabee-private-zero-prompt-storage-wallet-auth": (
    <>
      <P>
        When you use most AI chatbots, the operator can read your conversations, link them to your account, share them with third parties, use them to train future models, and comply with government requests for them. These are not hypothetical risks, they are the business model.
      </P>
      <P>
        Gigabee is built differently. This post explains exactly what the system stores, what it never stores, and how the architecture makes certain types of surveillance structurally impossible, not just against our policy, but technically unavailable.
      </P>

      <H2>What Gigabee does NOT store</H2>
      <H3>Your prompts and responses</H3>
      <P>
        The Gigabee API never writes conversation content to a database. When you send a message, it is forwarded to a worker for inference and the response is streamed back. Nothing is persisted on the server side. There are no conversation logs to subpoena, no training datasets built from your chats, and no replay possible after the session ends.
      </P>
      <H3>Your identity</H3>
      <P>
        Gigabee has no email address, phone number, or real name associated with your account. Your account identifier is your Solana wallet public key. Creating an account means signing a short message with your private key, the equivalent of proving you control a cryptographic keypair, not revealing who you are.
      </P>
      <H3>Your IP address (linked to conversations)</H3>
      <P>
        While standard server logs capture IP addresses for security and abuse prevention (as every server does), these logs are not linked to conversation content. There is no table that joins "IP address X sent these messages" because conversation messages are never written to any table.
      </P>

      <H2>What Gigabee does store</H2>
      <P>Being honest about what is stored is as important as what is not:</P>
      <Ul
        items={[
          "Your wallet public key, this is your account identifier.",
          "Credit balance and transaction history, required to operate the billing system.",
          "Job metadata, timestamp, model used, credits deducted, worker ID. No content.",
          "Deposit records, the on-chain $GB transaction hash that funded your account.",
          "Earnings records for workers, job IDs, credit amounts, payout status.",
          "Referral relationships, which wallet referred which, and aggregate spend for commission calculation.",
        ]}
      />
      <Note>
        Job metadata is structurally separated from content by design. A record says "user X used Bee Hover at 14:37 UTC", not what they asked or what the model answered.
      </Note>

      <H2>Where conversations live</H2>
      <P>
        Your conversation history is stored exclusively in your browser's localStorage. If you clear site data, uninstall the browser, or switch devices, your history is gone. There is no cloud sync, no server backup, and no way for Gigabee to recover it.
      </P>
      <P>
        This is a deliberate trade-off. You gain genuine privacy, nobody can access your history except you on your current device. You lose the convenience of cross-device sync. Most privacy-sensitive users consider this the right trade.
      </P>

      <H2>Workers and privacy</H2>
      <P>
        Workers, the GPU contributors who serve inference, receive a tokenized job payload. They see the prompt tokens necessary to generate a response. They do not see:
      </P>
      <Ul
        items={[
          "Who sent the job, the orchestrator strips user identity before forwarding.",
          "Previous conversation history, each job is a single context window, not a persistent session.",
          "Payment details, workers are paid via a separate earnings ledger, not linked to individual job content.",
        ]}
      />

      <H2>Open payment ledger</H2>
      <P>
        All $GB payments, both deposits from users and payouts to workers, are standard SPL token transfers on Solana mainnet. Every transaction is publicly visible on Solscan. This openness is intentional: it means Gigabee cannot secretly redirect funds, inflate earnings, or manipulate the payment rail without it being detectable on-chain.
      </P>

      <H2>Is Gigabee private enough for sensitive use?</H2>
      <P>
        Gigabee provides strong privacy guarantees for conversation content and user identity. It is significantly more private than any mainstream AI product that logs your conversations by default.
      </P>
      <P>
        However, no networked system is perfectly private. If you require absolute confidentiality, for legal, medical, or highly sensitive personal matters, the strongest guarantee is a fully local model running on hardware you control, with no network connection. Gigabee's native worker mode with Ollama is one step in that direction, but the routing layer still involves the orchestrator.
      </P>
      <P>
        For everyday private AI use, asking questions you would rather not have associated with your name and stored indefinitely, Gigabee's architecture offers a genuinely different and more respectful baseline than the industry default.
      </P>

      <H2>Summary</H2>
      <Table
        headers={["Data type", "Stored by Gigabee?", "Where"]}
        rows={[
          ["Prompt content", "No", "Never written to server"],
          ["Response content", "No", "Never written to server"],
          ["Conversation history", "No", "Browser localStorage only"],
          ["User real identity", "No", "Wallet public key only"],
          ["Credit balance", "Yes", "Internal database"],
          ["Job metadata (no content)", "Yes", "Internal database"],
          ["$GB payment records", "Yes", "Internal DB + Solana blockchain"],
        ]}
      />
    </>
  ),

  // -------------------------------------------------------------------------
  "gigabee-worker-v1-3-update-earnings-benchmark-monitor": (
    <>
      <P>
        This post covers four fixes shipped in the v1.3 worker script and server update. Each one
        addresses a bug that silently prevented the system from working as intended. If you ran a
        worker before July 3, 2026, upgrading to the latest script is strongly recommended.
      </P>

      <H2>Fix 1 — Earnings never recorded (critical)</H2>
      <P>
        The most serious bug: <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">finishJob()</code> on
        the server was writing <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">workerId: undefined</code> to
        the earnings ledger on every completed job. This meant zero earnings were ever stored in the
        database, regardless of how many jobs a worker served. The earn page showed a balance of $0.00
        even after hours of active work.
      </P>
      <P>
        The fix links each in-memory worker record to its database UUID at registration time.
        When <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">hive.ts</code> upserts
        a worker row into the database, it calls <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">orchestrator.setWorkerDbId(socketId, dbWorkerId)</code> to
        store the UUID. When a job finishes, <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">finishJob()</code> looks
        up the correct UUID and passes it to <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">recordJobCompletion()</code>.
        Earnings are now correctly attributed from the first job.
      </P>
      <Note>
        If you earned jobs before this fix, those earnings were not recorded. There is no retroactive
        credit — only jobs completed after the July 3 deploy are tracked.
      </Note>

      <H2>Fix 2 — Benchmark reporting ~0 tok/s on cold start</H2>
      <P>
        When the worker script first starts, the Ollama model is not yet loaded into GPU VRAM. The
        previous benchmark run measured this cold-load time as part of the inference speed, causing
        the reported speed to be artificially near zero (sometimes 0–1 tok/s) even on fast hardware
        like an RTX 4090.
      </P>
      <P>
        The fix adds a warm-up pass before the timed benchmark run. The warm-up sends a short silent
        prompt to Ollama, which loads the model into VRAM. The result is discarded. The timed run
        then executes with the model already resident in VRAM, so the measured speed reflects real
        inference throughput. Speed is also floored at 1 tok/s to prevent division-by-zero errors
        downstream. Expected output now looks like this:
      </P>
      <Note>
        [gigabee] Benchmarking llama3.2:3b…{"\n"}
        [gigabee] Benchmark: ~42 tok/s
      </Note>

      <H2>Fix 3 — Worker monitor panel always showed "No worker registered"</H2>
      <P>
        The earn page includes a native worker status panel that is supposed to show your worker's
        online/offline state in real time. Before this fix, the panel always displayed "No worker
        registered yet" even when a worker was actively serving jobs.
      </P>
      <P>
        The root cause was that <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">hive.ts</code> was
        not writing anything to the database when a worker connected. The panel queries the database,
        so it found nothing. The fix makes <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">hive.ts</code> upsert
        a row into <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">workersTable</code> on
        every <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">worker:register</code> event
        and update <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">lastSeenAt</code> on
        every <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">worker:heartbeat</code>.
        The panel now shows live status, last-seen time (UTC), and all-time job count, refreshing
        every 5 seconds.
      </P>

      <H2>Fix 4 — Pending earnings never became available (scheduler)</H2>
      <P>
        Honey earnings sit in <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">pending</code> status
        for 24 hours after a job completes. After that window, they are supposed to move
        to <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">available</code> status so you can
        withdraw them. Before this fix, no such transition ever happened — the scheduler that drives
        it did not exist.
      </P>
      <P>
        A background scheduler now runs every 5 minutes inside the API server process. It queries
        the earnings ledger for rows where <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">status = 'pending'</code> and <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">availableAt ≤ NOW()</code>,
        then bulk-updates them to <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">available</code>.
        Your withdrawal balance on the earn page now reflects earnings that have passed the 24-hour
        hold, and the Withdraw button becomes active once the minimum threshold ($25.00 in $GB) is reached.
      </P>

      <H2>How to update your worker script</H2>
      <P>
        If you are running the old script, stop it and re-download the latest version:
      </P>
      <Note>
        {"# macOS / Linux\n"}
        {"curl -fsSL https://raw.githubusercontent.com/mr-gigabee/gigabee/main/worker/gigabee-worker.mjs -o gigabee-worker.mjs\n\n"}
        {"# Windows (Command Prompt)\n"}
        {"curl -fsSL https://raw.githubusercontent.com/mr-gigabee/gigabee/main/worker/gigabee-worker.mjs -o gigabee-worker.mjs"}
      </Note>
      <P>
        The <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">npm install socket.io-client</code> step
        does not need to be repeated — the dependency is already installed. Just re-download the
        script and restart.
      </P>

      <H2>Summary of changes</H2>
      <Table
        headers={["Change", "Impact"]}
        rows={[
          ["Earnings recorded per job", "Balance now increases after every completed job"],
          ["Benchmark warm-up pass", "Reported tok/s reflects real VRAM-resident speed"],
          ["Worker monitor panel", "Online/offline status, last seen UTC, job count — live"],
          ["Earnings scheduler", "Pending Honey matures to available after 24 hours"],
          ["Worker status enum fix", "Panel correctly shows idle / serving / offline"],
          ["Landing page worker count", "Live count from in-memory orchestrator, not stale DB"],
        ]}
      />
    </>
  ),

  // -------------------------------------------------------------------------
  "gigabee-hermes-agent-decentralized-gpu-backend": (
    <>
      <P>
        Hermes Agent, NousResearch's open-source autonomous agent toolkit, now works with Gigabee as
        its inference backend. This means your Hermes agents run on real contributor GPUs distributed
        around the world instead of routing every request through a single cloud provider. Setup is
        two config lines.
      </P>

      <H2>What is Hermes Agent?</H2>
      <P>
        Hermes is a CLI-first agent framework from NousResearch. It uses the OpenAI chat completions
        interface internally, which means any provider that exposes an OpenAI-compatible endpoint can
        be dropped in as the backend. Gigabee's <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">/api/v1/chat/completions</code> endpoint
        is fully compatible.
      </P>

      <H2>Step 1: Create an API key</H2>
      <P>
        Go to{" "}
        <a href="/earn" className="text-primary underline underline-offset-2">gigabee.io/earn</a>{" "}
        and open the API Keys tab. Click "Create key", optionally add a label like{" "}
        <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">hermes-dev</code>,
        and copy the key shown. It starts with <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">giga_</code> and will
        not be shown again — save it now.
      </P>

      <H2>Step 2: Install Hermes and configure</H2>
      <P>
        Install Hermes Agent via pip, then configure it to use Gigabee as the backend:
      </P>
      <Note>
        pip install hermes-agent
      </Note>
      <Note>
        hermes config set base_url https://gigabee.io/api/v1{"\n"}
        hermes config set api_key giga_your_key_here{"\n"}
        hermes config set model bee-glide
      </Note>
      <P>
        That is the complete setup. No environment variables, no wrappers, no SDK changes. The config
        is stored in <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">~/.hermes/config.yaml</code>.
      </P>

      <H2>Step 3: Run your first task</H2>
      <Note>
        hermes run "Research and summarise the key findings from the last 3 months of AI papers on sparse mixture-of-experts."
      </Note>
      <P>
        Hermes will route the inference through Gigabee, routing to whichever GPU worker is available
        for the bee-glide tier. Tokens stream back in real time. Your credit balance decreases by 15
        credits ($0.15) per request.
      </P>

      <H2>Using Bee Hover instead</H2>
      <P>
        Bee Hover is 10 credits ($0.10) per request — faster for lighter tasks. Switch models with
        one config line:
      </P>
      <Note>
        hermes config set model bee-hover
      </Note>

      <H2>Python SDK alternative</H2>
      <P>
        If you are embedding Hermes in your own Python code rather than using the CLI, use the{" "}
        <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">openai-agents</code> SDK
        directly:
      </P>
      <Note>
        {`from agents import Agent, Runner, OpenAIChatCompletionsModel\nfrom openai import AsyncOpenAI\n\nclient = AsyncOpenAI(\n    base_url="https://gigabee.io/api/v1",\n    api_key="giga_your_key_here",\n)\n\nagent = Agent(\n    name="Bee",\n    instructions="You are a helpful assistant.",\n    model=OpenAIChatCompletionsModel(\n        model="bee-glide",\n        openai_client=client,\n    ),\n)\n\nresult = Runner.run_sync(agent, "Summarise today's AI news.")\nprint(result.final_output)`}
      </Note>

      <H2>SSE streaming support</H2>
      <P>
        Gigabee's API supports server-sent events streaming with{" "}
        <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">"stream": true</code>{" "}
        in the request body. The response chunks follow the OpenAI{" "}
        <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">chat.completion.chunk</code>{" "}
        format, so every framework that streams from OpenAI streams from Gigabee without changes.
        Hermes uses streaming by default when it's available.
      </P>

      <H2>Why decentralized inference for agents?</H2>
      <P>
        Autonomous agents often run long multi-step tasks. There are three reasons decentralized
        inference is a better fit for this workload than centralized providers:
      </P>
      <Ul
        items={[
          "No rate limits from a single provider — jobs route to whatever worker is available, so your agent is never queued behind someone else's request.",
          "No prompt storage — the Gigabee API never writes conversation content to a database. Long-running agents that process sensitive documents benefit from this structurally, not just contractually.",
          "Transparent billing — each request deducts a fixed credit amount. There are no per-token overages or surprise invoices. Your agent's cost is exactly the number of requests times the model tier cost.",
        ]}
      />

      <H2>API key management</H2>
      <P>
        From the{" "}
        <a href="/earn" className="text-primary underline underline-offset-2">
          Earn → API Keys
        </a>{" "}
        tab you can:
      </P>
      <Ul
        items={[
          "Create up to 3 API keys per account, each with an optional label.",
          "See the last-used date for each key — useful for auditing which keys are still active.",
          "Revoke any key immediately — ideal when rotating credentials or decommissioning a project.",
        ]}
      />
      <Note>
        API keys are shown in full exactly once, at creation. After that, only the first 12 characters
        are visible. Store the full key in your secrets manager, not a config file.
      </Note>

      <Table
        headers={["Model", "Cost per request", "Best for"]}
        rows={[
          ["bee-hover", "10 credits / $0.10", "Fast responses, lighter reasoning, high-volume pipelines"],
          ["bee-glide", "15 credits / $0.15", "Long reasoning, code generation, research tasks"],
        ]}
      />
    </>
  ),
};

// ---------------------------------------------------------------------------
// Category colour map
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BlogPost() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const meta = BLOG_POSTS.find((p) => p.slug === slug);
  const content = CONTENT[slug];
  const isLoggedIn = !!getSessionToken();

  if (!meta || !content) return <NotFound />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="max-w-[1080px] mx-auto px-4 h-14 flex items-center gap-6">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <BeeLogo className="h-7 w-7 text-primary" />
              <span className="font-semibold text-sm">Gigabee</span>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-5 text-sm text-muted-foreground ml-4">
            <Link href="/chat" className="hover:text-foreground transition-colors">Chat</Link>
            <Link href="/earn" className="hover:text-foreground transition-colors">Earn</Link>
            <Link href="/docs" className="hover:text-foreground transition-colors">Docs</Link>
            <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/chat">
                <Button size="sm" className="h-8 text-xs">Open Chat</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="sm" className="h-8 text-xs">Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Back link */}
      <div className="max-w-[720px] mx-auto px-4 pt-8">
        <Link href="/blog">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Blog
          </span>
        </Link>
      </div>

      {/* Article header */}
      <article className="max-w-[720px] mx-auto px-4 pt-6 pb-24">
        <header className="mb-10 space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                CATEGORY_COLORS[meta.category] ?? "bg-secondary text-muted-foreground border-border"
              }`}
            >
              {meta.category}
            </span>
            <span className="text-xs text-muted-foreground">{meta.readTime}</span>
          </div>
          <h1 className="text-2xl font-bold leading-snug tracking-tight">{meta.title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{meta.excerpt}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/60">
            <time dateTime={meta.publishedAt}>{formatDate(meta.publishedAt)}</time>
            <span>·</span>
            <span>Gigabee Team</span>
          </div>
        </header>

        {/* Body */}
        <div className="prose-like">{content}</div>

        {/* Post footer CTA */}
        <div className="mt-16 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <p className="text-sm font-medium">Ready to try Gigabee?</p>
          <p className="text-xs text-muted-foreground">
            Chat privately with AI powered by community GPUs, or start earning Honey by sharing your own.
          </p>
          <div className="flex justify-center gap-3 pt-1">
            <Link href="/chat">
              <Button size="sm" className="h-8 text-xs">Start chatting</Button>
            </Link>
            <Link href="/earn">
              <Button size="sm" variant="outline" className="h-8 text-xs">Start earning</Button>
            </Link>
          </div>
        </div>

        {/* Related posts */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold mb-4">More from the blog</h2>
          <div className="space-y-3">
            {BLOG_POSTS.filter((p) => p.slug !== slug).slice(0, 3).map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`}>
                <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-secondary/40 transition-colors cursor-pointer">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${
                      CATEGORY_COLORS[p.category] ?? "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {p.category}
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-snug hover:text-primary transition-colors">
                      {p.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(p.publishedAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
