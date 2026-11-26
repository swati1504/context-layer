"use client";
import { useRouter } from "next/navigation";
import { log } from "@/lib/store";

export default function Enter({ className, children }: { className?: string; children: React.ReactNode }) {
  const r = useRouter();
  return (
    <button type="button" className={className} onClick={() => { try { localStorage.setItem("cl_seen", "1"); } catch {} log("landing_enter"); r.push("/"); }}>
      {children}
    </button>
  );
}
