"use client";

import { useEffect, useState } from "react";
import type { ReplyTemplate } from "@/lib/reply-templates";

/** Fetches the account's quick-reply templates once, for "/" autocomplete in reply boxes. */
export function useReplyTemplates(): ReplyTemplate[] {
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/reply-templates");
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          setTemplates(json.data.templates as ReplyTemplate[]);
        }
      } catch {
        // Best-effort — autocomplete just won't have suggestions if this fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return templates;
}
