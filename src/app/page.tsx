"use client";

import { useState } from "react";
import { ArrowRight, BookOpenText, ClipboardList, FileSpreadsheet, FlaskConical, Info, Loader2, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/fah/services/auth";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const FEATURES = [
  { icon: BookOpenText, title: "Course syllabi", text: "Institutional template sections, PO–PEO alignment, CLOs and an 18-week learning plan." },
  { icon: Target, title: "IT Program Outcomes", text: "A managed outcome library with safe archiving and explicit syllabus updates." },
  { icon: ClipboardList, title: "Exam Builder", text: "Write, generate or import exams with separate answer keys and rubrics." },
  { icon: FileSpreadsheet, title: "Table of Specifications", text: "Synchronized horizontal and vertical item placement from real exam items." },
];

export default function Main() {
  const auth = useAuth();
  const [name, setName] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const google = async () => {
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      await auth.signInWithGoogle();
    } catch (e) {
      setGoogleError(e instanceof Error ? e.message : String(e));
      setGoogleBusy(false);
    }
  };

  const demo = () => {
    auth.enterDemo(name);
    window.location.href = "/app#/dashboard";
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f4ea] text-slate-800">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,rgba(244,208,0,0.18),transparent_60%),radial-gradient(70%_60%_at_0%_100%,rgba(27,36,102,0.14),transparent_60%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(27,36,102,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(27,36,102,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#1b2466_0%,#1b2466_50%,#f4d000_50%,#f4d000_100%)]" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-12 md:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1b2466]/15 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#1b2466]">
            For college faculty
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] text-[#1b2466] md:text-6xl">
            Faculty Academic <span className="relative whitespace-nowrap">Helper<span aria-hidden className="absolute -bottom-1 left-0 h-2 w-full -skew-x-12 bg-[#f4d000]/70" /></span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-700 md:text-lg">
            Prepare course syllabi on the institutional template, manage program outcomes, build examinations and produce Tables of Specifications — with every AI
            suggestion reviewed by you before it changes anything.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-[#1b2466]/10 bg-white/75 p-4 shadow-sm backdrop-blur fill-mode-both"
                style={{ animationDelay: `${150 + i * 90}ms`, animationDuration: "600ms" }}
              >
                <f.icon className="mb-2 size-5 text-amber-600" />
                <p className="font-display text-base font-semibold text-[#1b2466]">{f.title}</p>
                <p className="mt-1 text-sm text-slate-600">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="signin-title" className="animate-in fade-in slide-in-from-bottom-6 rounded-3xl border border-[#1b2466]/10 bg-white p-6 shadow-[0_30px_80px_-30px_rgba(27,36,102,0.45)] duration-700 md:p-8">
          <h2 id="signin-title" className="font-display text-2xl font-semibold text-[#1b2466]">
            Sign in
          </h2>

          {auth.status === "signed-in" && auth.session ? (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-slate-600">
                You are signed in as <strong>{auth.session.name}</strong>
                {auth.session.mode === "demo" && " (demonstration mode)"}.
              </p>
              <Button className="h-11 w-full bg-[#1b2466] text-base hover:bg-[#262f7a]" onClick={() => (window.location.href = "/app#/dashboard")}>
                Open workspace <ArrowRight className="size-4" />
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => void auth.signOut()}>
                Sign out
              </Button>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="h-11 w-full gap-3 border-slate-300 text-base"
                  onClick={google}
                  disabled={auth.googleConfigured !== true || googleBusy}
                  aria-describedby="google-status"
                >
                  {googleBusy ? <Loader2 className="size-5 animate-spin" /> : <GoogleMark />} Continue with Google
                </Button>
                <p id="google-status" className="flex items-start gap-1.5 text-xs text-slate-500">
                  {auth.googleConfigured === null ? (
                    <>
                      <Loader2 className="mt-0.5 size-3 animate-spin" /> Checking Google sign-in configuration…
                    </>
                  ) : auth.googleConfigured ? (
                    <>
                      <ShieldCheck className="mt-0.5 size-3.5 text-emerald-600" /> Google sign-in is configured.
                    </>
                  ) : (
                    <>
                      <Info className="mt-0.5 size-3.5 text-amber-600" /> Google sign-in is not configured on this server yet. Use demonstration mode below.
                    </>
                  )}
                </p>
                {googleError && (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    {googleError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-slate-400">
                <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="space-y-3 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-fuchsia-900">
                  <FlaskConical className="size-4" /> Demonstration mode
                </p>
                <p className="text-xs leading-relaxed text-fuchsia-900/80">
                  No account is created and nothing is verified. Your work is stored only in this browser. Demo records are labeled.
                </p>
                <label htmlFor="demo-name" className="block text-xs font-medium text-slate-700">
                  Display name (optional)
                </label>
                <Input id="demo-name" placeholder="e.g. Prof. Dela Cruz" value={name} onChange={(e) => setName(e.target.value)} className="bg-white" />
                <Button className="h-10 w-full bg-fuchsia-800 hover:bg-fuchsia-900" onClick={demo}>
                  Enter demonstration mode <ArrowRight className="size-4" />
                </Button>
              </div>

              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
                <Sparkles className="mt-0.5 size-3 shrink-0" />
                Signing in with Google does not connect a ChatGPT account. AI features run through this application’s secure server and are shown as connected,
                unavailable or demonstration in the workspace.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
