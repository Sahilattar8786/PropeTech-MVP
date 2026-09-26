"use client";

import { useEffect, useRef } from "react";

/** Keeps a chat thread pinned to the newest message, like WhatsApp. */
export function ScrollToBottom({ children, className, watch }: { children: React.ReactNode; className?: string; watch: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [watch]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
