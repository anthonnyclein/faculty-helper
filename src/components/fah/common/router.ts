"use client";
// Minimal hash router for the single-page application (#/section/id/sub).
import { useEffect, useState } from "react";

export function parseHash(hash: string): string[] {
  return hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
}

export function navigate(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (window.location.hash !== `#${p}`) window.location.hash = p;
  window.scrollTo({ top: 0 });
}

export function useHashRoute(): string[] {
  const [segs, setSegs] = useState<string[]>([]);
  useEffect(() => {
    const on = () => setSegs(parseHash(window.location.hash));
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return segs;
}

export function href(path: string) {
  return `#${path.startsWith("/") ? path : `/${path}`}`;
}
