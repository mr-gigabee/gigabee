import { useEffect } from "react";
import { useLocation } from "wouter";
import { BeeLogo } from "@/components/icons";

export default function Join() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && /^bee-[a-z0-9]+-[a-z0-9]+$/i.test(ref)) {
      localStorage.setItem("gigabee_ref", ref);
    }
    navigate("/login");
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <BeeLogo className="h-10 w-10" />
        <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    </div>
  );
}
