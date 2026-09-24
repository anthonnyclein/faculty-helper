// src/app/layout.tsx
import React from "react";
import type { Metadata } from "next";
import { Fraunces, Public_Sans, JetBrains_Mono } from "next/font/google";
import "@fontsource/carlito/400.css";
import "@fontsource/carlito/700.css";
import "@fontsource/arimo/400.css";
import "@fontsource/arimo/400-italic.css";
import "@fontsource/arimo/700.css";
import "./globals.css";
import { ScriptExecutor } from "@/components/ScriptExecutor";
import { DevToolsHandler } from "@/components/DevToolsHandler";
import { GlobalErrorCatcher } from "@/components/GlobalErrorCatcher";
import { TemporalLinkBanner } from "@/components/TemporalLinkBanner";

const display = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Public_Sans({ variable: "--font-body", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Faculty Academic Helper",
  description: "Course syllabi, program outcomes, exams and Tables of Specifications for college faculty.",
};

// SUPER IMPORTANT: NOT EDIT THE FOLLOWING 2 LINES TO FORCE NEXT.JS TO RENDER DYNAMICALLY
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-sans antialiased`}>
        <GlobalErrorCatcher />
        <ScriptExecutor />
        <DevToolsHandler />
        {/* Development-preview only banner. Kept outside the page wrapper so it never covers content. */}
        <TemporalLinkBanner />
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
