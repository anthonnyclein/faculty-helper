"use client";
// Replaceable authentication service. Application sign-in (Google via Better Auth) is kept
// separate from AI access: signing in with Google does NOT connect ChatGPT or OpenAI.

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { signIn, signOut as baSignOut, useSession } from "@/lib/auth-client";
import { demoSessionStore } from "./storage";
import type { AppSession } from "../types";

export type AuthStatus = "loading" | "signed-out" | "signed-in";

let googleConfiguredCache: boolean | null = null;

export function useGoogleConfigured(): boolean | null {
  const [v, setV] = useState<boolean | null>(googleConfiguredCache);
  useEffect(() => {
    if (googleConfiguredCache !== null) return;
    api.get<{ googleConfigured: boolean }>("/api/auth-config").then((r) => {
      googleConfiguredCache = !!(r.ok && r.data?.googleConfigured);
      setV(googleConfiguredCache);
    });
  }, []);
  return v;
}

export function useAuth() {
  const googleConfigured = useGoogleConfigured();
  const { data: baSession, isPending } = useSession();
  const [demo, setDemo] = useState<AppSession | null>(null);
  const [demoLoaded, setDemoLoaded] = useState(false);

  useEffect(() => {
    setDemo(demoSessionStore.get());
    setDemoLoaded(true);
  }, []);

  const session: AppSession | null = baSession?.user
    ? { mode: "google", name: baSession.user.name, email: baSession.user.email, image: baSession.user.image }
    : demo;

  const status: AuthStatus = !demoLoaded || (isPending && !demo) ? "loading" : session ? "signed-in" : "signed-out";

  const signInWithGoogle = useCallback(async () => {
    console.log("[auth] Google sign-in requested");
    const r = await signIn.social({ provider: "google", callbackURL: "/app" });
    if (r?.error) {
      console.error("[auth] Google sign-in failed", r.error);
      throw new Error(r.error.message || "Google sign-in failed.");
    }
  }, []);

  const enterDemo = useCallback((name?: string) => {
    const s: AppSession = { mode: "demo", name: name?.trim() || "Demo Faculty" };
    demoSessionStore.set(s);
    setDemo(s);
    console.log("[auth] entered demonstration mode");
  }, []);

  const signOut = useCallback(async () => {
    demoSessionStore.set(null);
    setDemo(null);
    if (baSession?.user) await baSignOut();
    console.log("[auth] signed out");
  }, [baSession]);

  return { status, session, googleConfigured, signInWithGoogle, enterDemo, signOut };
}
