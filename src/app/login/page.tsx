"use client";

import { useEffect } from "react";

// Sign-in happens on the entry screen (Continue with Google or demonstration mode).
export default function Redirect() {
  useEffect(() => {
    window.location.replace("/");
  }, []);
  return null;
}
