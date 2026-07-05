import { Link, useLocation } from "wouter";
import { useBrowserWorkerContext } from "@/contexts/BrowserWorkerContext";
import { Cpu } from "lucide-react";

export function WorkerStatusPill() {
  const bw = useBrowserWorkerContext();
  const [location] = useLocation();

  if (bw.status === "idle" || bw.status === "error" || location === "/earn") {
    return null;
  }

  const isActive = bw.status === "ready" || bw.status === "processing";
  const isLoading = bw.status === "downloading" || bw.status === "loading";

  let label = "";
  if (bw.status === "processing") label = `Processing · ${bw.currentJobTokens} tok`;
  else if (bw.status === "ready") label = "Online, waiting for jobs";
  else if (bw.status === "downloading") label = `Downloading model ${bw.progress}%`;
  else if (bw.status === "loading") label = "Loading model…";
  else if (bw.status === "benchmarking") label = "Benchmarking GPU…";
  else if (bw.status === "reconnecting") label = "Reconnecting…";
  else if (bw.status === "checking") label = "Checking GPU…";

  return (
    <Link href="/earn">
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-card/90 backdrop-blur px-3.5 py-2 shadow-lg text-xs font-medium cursor-pointer hover:bg-card transition-colors">
        <span className="relative flex h-2 w-2">
          {isActive && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              bw.status === "processing"
                ? "bg-green-400"
                : isLoading
                ? "bg-yellow-400"
                : isActive
                ? "bg-primary"
                : "bg-muted-foreground"
            }`}
          />
        </span>
        <Cpu className="h-3 w-3 text-muted-foreground" />
        <span className="text-foreground">{label}</span>
      </div>
    </Link>
  );
}
