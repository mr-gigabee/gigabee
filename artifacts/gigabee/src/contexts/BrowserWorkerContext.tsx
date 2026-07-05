import { createContext, useContext, type ReactNode } from "react";
import { useBrowserWorker, type BrowserWorkerState } from "@/hooks/useBrowserWorker";

const BrowserWorkerContext = createContext<BrowserWorkerState | null>(null);

export function BrowserWorkerProvider({ children }: { children: ReactNode }) {
  const state = useBrowserWorker();
  return (
    <BrowserWorkerContext.Provider value={state}>
      {children}
    </BrowserWorkerContext.Provider>
  );
}

export function useBrowserWorkerContext(): BrowserWorkerState {
  const ctx = useContext(BrowserWorkerContext);
  if (!ctx) throw new Error("useBrowserWorkerContext must be used within BrowserWorkerProvider");
  return ctx;
}
