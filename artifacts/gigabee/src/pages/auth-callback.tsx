import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useVerifyMagicLink } from "@workspace/api-client-react";
import { setSessionToken } from "@/lib/socket";
import { BeeLogo } from "@/components/icons";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const verifyMutation = useVerifyMagicLink();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setError("Invalid or missing magic link token.");
      return;
    }

    verifyMutation
      .mutateAsync({ data: { token } })
      .then((session) => {
        setSessionToken(session.sessionToken);
        // Reload so the auth token getter picks up the new token
        window.location.href = "/chat";
      })
      .catch(() => {
        setError("This link has expired or has already been used. Please request a new one.");
      });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <BeeLogo className="h-10 w-10 mb-6" />

      {error ? (
        <div className="text-center">
          <p className="text-sm text-destructive mb-4">{error}</p>
          <a href="/login" className="text-sm text-primary hover:underline">
            Back to login
          </a>
        </div>
      ) : (
        <div className="text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </div>
      )}
    </div>
  );
}
