import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { OnboardingModal } from "@/components/onboarding-modal";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getSessionToken, clearSessionToken, disconnectSocket } from "@/lib/socket";
import { BrowserWorkerProvider } from "@/contexts/BrowserWorkerContext";
import { WorkerStatusPill } from "@/components/WorkerStatusPill";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

setAuthTokenGetter(getSessionToken);

const Home = lazy(() => import("@/pages/home"));
const Chat = lazy(() => import("@/pages/chat"));
const Earn = lazy(() => import("@/pages/earn"));
const Docs = lazy(() => import("@/pages/docs"));
const Login = lazy(() => import("@/pages/login"));
const Join = lazy(() => import("@/pages/join"));
const AuthCallback = lazy(() => import("@/pages/auth-callback"));
const Admin = lazy(() => import("@/pages/admin"));
const Blog = lazy(() => import("@/pages/blog"));
const BlogPost = lazy(() => import("@/pages/blog-post"));

function LoadingFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getSessionToken();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!token) navigate("/login");
  }, []);

  if (!token) return <LoadingFallback />;
  return <>{children}</>;
}

const Stats = lazy(() => import("@/pages/stats"));

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/chat">
          <ProtectedRoute><Chat /></ProtectedRoute>
        </Route>
        <Route path="/earn">
          <ProtectedRoute><Earn /></ProtectedRoute>
        </Route>
        <Route path="/docs" component={Docs} />
        <Route path="/login" component={Login} />
        <Route path="/join" component={Join} />
        <Route path="/auth/callback" component={AuthCallback} />
        <Route path="/admin" component={Admin} />
        <Route path="/stats" component={Stats} />
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug" component={BlogPost} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    const handler = () => queryClient.invalidateQueries();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // When user switches wallet account in Phantom or Solflare,
  // clear the stale session so they must re-authenticate with the new wallet.
  useEffect(() => {
    function handleAccountChange() {
      clearSessionToken();
      disconnectSocket();
      queryClient.clear();
      window.location.href = "/login";
    }

    const solana = (window as { solana?: { on?: (e: string, fn: () => void) => void; off?: (e: string, fn: () => void) => void } }).solana;
    const solflare = (window as { solflare?: { on?: (e: string, fn: () => void) => void; off?: (e: string, fn: () => void) => void } }).solflare;

    solana?.on?.("accountChanged", handleAccountChange);
    solflare?.on?.("accountChanged", handleAccountChange);

    return () => {
      solana?.off?.("accountChanged", handleAccountChange);
      solflare?.off?.("accountChanged", handleAccountChange);
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="gigabee-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserWorkerProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
              <OnboardingModal />
              <WorkerStatusPill />
            </WouterRouter>
            <Toaster />
          </BrowserWorkerProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
