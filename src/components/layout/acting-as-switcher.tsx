"use client";

import { useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { TEAM_MEMBERS, getActingAs, setActingAs } from "@/lib/team";

/**
 * Everyone signs in with one shared account, so this lets each person on a
 * given device say who they are. Opening an unread lead auto-assigns to
 * whoever is picked here (see lead-form.tsx).
 */
export function ActingAsSwitcher() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setName(getActingAs());
  }, []);

  function handleChange(value: string) {
    setActingAs(value);
    setName(value);
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-text-muted">
      <UserCircle2 size={16} strokeWidth={1.8} />
      <select
        value={name ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent text-foreground focus:outline-none cursor-pointer"
        aria-label="Acting as"
      >
        <option value="" disabled>
          Who are you?
        </option>
        {TEAM_MEMBERS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
