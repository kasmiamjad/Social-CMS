"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface RealtimeRefreshProps {
  /** Tables to listen to for INSERT/UPDATE/DELETE (RLS-scoped to the user). */
  tables: string[];
}

/**
 * Subscribes to Supabase Realtime postgres_changes on the given tables and
 * refreshes the server-rendered page the instant a row changes — replacing
 * interval polling with push updates.
 *
 * Robustness: also refreshes on (re)subscribe, so anything that changed while
 * the socket was disconnected is picked up on reconnect. router.refresh() calls
 * are debounced to coalesce bursts.
 */
export function RealtimeRefresh({ tables }: RealtimeRefreshProps) {
  const router = useRouter();
  const tablesKey = tables.join(",");

  useEffect(() => {
    const list = tablesKey.split(",").filter(Boolean);
    if (list.length === 0) return;

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    const channel = supabase.channel(`realtime:${tablesKey}`);
    for (const table of list) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }

    // Authenticate the realtime socket so RLS-protected tables deliver events.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) {
        supabase.realtime.setAuth(data.session.access_token);
      }
      channel.subscribe((status) => {
        // Catch anything missed during connect/reconnect.
        if (status === "SUBSCRIBED") refresh();
      });
    });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [tablesKey, router]);

  return null;
}
