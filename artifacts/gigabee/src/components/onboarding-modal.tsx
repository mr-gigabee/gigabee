import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getSessionToken } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { MessageSquare, Cpu, ArrowRight } from "lucide-react";

const STORAGE_KEY = "gigabee-onboarding-done";

type Step = "welcome" | "choose";

export function OnboardingModal() {
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>("welcome");

  useEffect(() => {
    function check() {
      const done = localStorage.getItem(STORAGE_KEY);
      const token = getSessionToken();
      setVisible(!done && !!token);
    }

    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function goChat() {
    dismiss();
    navigate("/chat");
  }

  function goEarn() {
    dismiss();
    navigate("/earn");
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-border bg-card shadow-2xl">
        {step === "welcome" ? (
          <div className="p-8">
            <h2 className="text-xl font-semibold text-foreground mb-3 tracking-tight">
              Welcome to Gigabee
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Gigabee is a decentralized AI inference network. Your prompts run
              on real GPUs contributed by people in the Hive. To get you
              started, your account comes with{" "}
              <span className="text-primary font-medium">10 free credits</span>{" "}
              No card or deposit needed.
            </p>

            <ol className="space-y-3 mb-8">
              {[
                "Type a prompt and pick Bee Hover or Bee Glide. Your free credits work on every model.",
                "When they run out, top up with $GB on Solana. Credits never expire.",
                "Got a GPU? Earn Honey ($GB) by serving inference jobs for the network.",
              ].map((text, i) => (
                <li key={i} className="flex gap-3 text-sm text-muted-foreground">
                  <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary text-xs font-semibold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{text}</span>
                </li>
              ))}
            </ol>

            <Button className="w-full gap-2 h-11" onClick={() => setStep("choose")}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="p-8">
            <h2 className="text-xl font-semibold text-foreground mb-1 tracking-tight">
              How do you want to start?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              You can do both. Pick where to go first.
            </p>

            <div className="space-y-3 mb-6">
              <button
                onClick={goChat}
                className="w-full text-left rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all p-4 group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5 group-hover:bg-primary/20 transition-colors">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-0.5">Chat with Bee</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Start chatting now with your 10 free credits.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={goEarn}
                className="w-full text-left rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all p-4 group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5 group-hover:bg-primary/20 transition-colors">
                    <Cpu className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-0.5">Earn Honey</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Share your GPU and get paid in $GB on Solana.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={dismiss}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
