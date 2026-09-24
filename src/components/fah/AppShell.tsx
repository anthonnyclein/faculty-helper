"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  BookOpenText,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileSpreadsheet,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Settings2,
  Target,
  Users,
} from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { store, useStoreState } from "@/lib/fah/store";
import { useAuth } from "@/lib/fah/services/auth";
import { AiStatusBadge, LoadingBlock } from "./common/ui";
import { href, navigate, useHashRoute } from "./common/router";
import { Dashboard } from "./modules/dashboard/Dashboard";
import { SyllabusList } from "./modules/syllabi/SyllabusList";
import { SyllabusEditor } from "./modules/syllabi/SyllabusEditor";
import { SyllabusPreview } from "./modules/syllabi/SyllabusPreview";
import { OutcomesLibrary } from "./modules/outcomes/OutcomesLibrary";
import { ResourceLibrary } from "./modules/resources/ResourceLibrary";
import { ExamList } from "./modules/exams/ExamList";
import { ExamEditor } from "./modules/exams/ExamEditor";
import { ExamPreview } from "./modules/exams/ExamPreview";
import { TosList } from "./modules/tos/TosList";
import { TosEditor } from "./modules/tos/TosEditor";
import { PeopleManager } from "./modules/people/PeopleManager";
import { SettingsPage } from "./modules/settings/SettingsPage";

const NAV: { key: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "syllabi", label: "Course Syllabi", icon: BookOpenText },
  { key: "outcomes", label: "IT Program Outcomes", icon: Target },
  { key: "resources", label: "Resource Library", icon: Library },
  { key: "exams", label: "Exam Builder", icon: ClipboardList },
  { key: "tos", label: "Table of Specifications", icon: FileSpreadsheet },
  { key: "people", label: "Faculty and Signatories", icon: Users },
  { key: "settings", label: "Templates and Settings", icon: Settings2 },
];

function Route({ segs }: { segs: string[] }) {
  const [section, id, sub] = segs;
  switch (section) {
    case "syllabi":
      if (id && sub === "preview") return <SyllabusPreview id={id} />;
      if (id) return <SyllabusEditor id={id} />;
      return <SyllabusList />;
    case "outcomes":
      return <OutcomesLibrary />;
    case "resources":
      return <ResourceLibrary />;
    case "exams":
      if (id && sub === "preview") return <ExamPreview id={id} />;
      if (id) return <ExamEditor id={id} />;
      return <ExamList />;
    case "tos":
      if (id) return <TosEditor id={id} />;
      return <TosList />;
    case "people":
      return <PeopleManager />;
    case "settings":
      return <SettingsPage />;
    default:
      return <Dashboard />;
  }
}

function NavList({ active, collapsed, onNavigate }: { active: string; collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((n) => {
        const on = active === n.key;
        const Icon = n.icon;
        return (
          <a
            key={n.key}
            href={href(`/${n.key}`)}
            onClick={onNavigate}
            aria-current={on ? "page" : undefined}
            title={collapsed ? n.label : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
              on ? "bg-white/12 text-white shadow-inner" : "text-indigo-100/80 hover:bg-white/8 hover:text-white",
              collapsed && "justify-center px-2"
            )}
          >
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", on ? "bg-amber-400 text-[#1b2466]" : "bg-white/5")}>
              <Icon className="size-4" />
            </span>
            {!collapsed && <span className="truncate">{n.label}</span>}
          </a>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const { ready, persist } = useStoreState();
  const auth = useAuth();
  const segs = useHashRoute();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = segs[0] || "dashboard";

  useEffect(() => {
    void store.init();
    setCollapsed(localStorage.getItem("fah:sidebar-collapsed") === "1");
  }, []);

  useEffect(() => {
    if (auth.status === "signed-out") window.location.href = "/";
  }, [auth.status]);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("fah:sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  };

  if (auth.status !== "signed-in" || !ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfaf6]">
        <LoadingBlock label={auth.status === "signed-in" ? "Restoring your saved work…" : "Checking sign-in…"} />
      </div>
    );
  }

  const session = auth.session!;
  const brand = (collapsed: boolean) => (
    <a href={href("/dashboard")} className="flex items-center gap-3 px-1">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-[#1b2466] shadow-md">
        <GraduationCap className="size-5" />
      </span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block font-display text-[15px] font-semibold text-white">Faculty Academic</span>
          <span className="block text-xs tracking-wide text-amber-200">Helper</span>
        </span>
      )}
    </a>
  );

  const userBox = (collapsed: boolean) => (
    <div className={cn("rounded-xl bg-white/5 p-3 text-xs text-indigo-100", collapsed && "p-2")}>
      {!collapsed && (
        <>
          <p className="truncate font-semibold text-white">{session.name}</p>
          <p className="truncate text-indigo-200/80">{session.mode === "google" ? session.email : "Not signed in with Google"}</p>
          {session.mode === "demo" && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[11px] font-medium text-fuchsia-100">
              <FlaskConical className="size-3" /> Demonstration mode
            </p>
          )}
        </>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={cn("mt-2 h-8 w-full justify-start text-indigo-100 hover:bg-white/10 hover:text-white", collapsed && "mt-0 justify-center px-0")}
        onClick={() => void auth.signOut()}
        aria-label="Sign out"
      >
        <LogOut className="size-4" /> {!collapsed && (session.mode === "demo" ? "Exit demo" : "Sign out")}
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#fbfaf6] text-slate-800">
      <Toaster richColors position="top-right" />
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col gap-6 overflow-y-auto bg-[#1b2466] bg-[radial-gradient(120%_60%_at_0%_0%,#2b3a9a_0%,transparent_60%)] p-4 transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-[268px]"
        )}
      >
        {brand(collapsed)}
        <div className="h-px bg-gradient-to-r from-amber-300/60 via-amber-300/10 to-transparent" />
        <NavList active={active} collapsed={collapsed} />
        <div className="mt-auto flex flex-col gap-3">
          {userBox(collapsed)}
          <Button variant="ghost" size="sm" className="text-indigo-200 hover:bg-white/10 hover:text-white" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Collapse</>}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-2.5 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <span className="font-display text-sm font-semibold text-[#1b2466] lg:hidden">Faculty Academic Helper</span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {session.mode === "demo" && (
              <span className="hidden items-center gap-1 rounded-full border border-fuchsia-300 bg-fuchsia-50 px-2.5 py-0.5 text-xs font-medium text-fuchsia-800 sm:inline-flex">
                <FlaskConical className="size-3" /> Demo sign-in
              </span>
            )}
            <AiStatusBadge />
            <span className="hidden text-xs text-slate-500 md:inline" aria-live="polite">
              {persist.status === "saving" ? "Writing to browser storage…" : persist.status === "error" ? "⚠ Browser storage error" : "Stored in this browser"}
            </span>
          </div>
        </div>

        <div id="fah-content" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8">
          <Route segs={segs} />
        </div>
      </div>

      {/* Mobile navigation */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-none bg-[#1b2466] p-4 text-white">
          <SheetHeader className="p-0">
            <SheetTitle className="text-white">
              <span className="sr-only">Navigation</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col gap-6">
            {brand(false)}
            <NavList active={active} onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto">{userBox(false)}</div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export { navigate };
