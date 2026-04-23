"use client";

import { useEffect } from "react";

const SUFFIX = "Projectly";

export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.title;
    const next = title ? `${title} · ${SUFFIX}` : SUFFIX;
    document.title = next;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
