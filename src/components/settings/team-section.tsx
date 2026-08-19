"use client";

import { useEffect, useState } from "react";
import { Users, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TeamUser {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Lets anyone signed in create a new login for this system. There are no
 * roles/permissions yet — every login can see and do everything the current
 * account can, same as today.
 */
export function TeamSection() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/team/users");
      const json = await res.json();
      if (res.ok && json.success) setUsers(json.data.users as TeamUser[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreate() {
    setError(null);
    if (!fullName.trim() || !email.trim() || !password) {
      setError("Fill in name, email, and password.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/v1/team/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to create user");
        return;
      }
      setUsers((prev) => [...prev, json.data.user as TeamUser]);
      setFullName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a login</CardTitle>
          <CardDescription>
            Create a new email/password login for someone on your team. Everyone can currently see and do
            everything — there are no per-user restrictions yet.
          </CardDescription>
        </CardHeader>

        <div className="grid sm:grid-cols-3 gap-3">
          <Input
            label="Full name"
            placeholder="e.g. Fateen"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-error">
            <AlertCircle size={13} strokeWidth={1.8} />
            {error}
          </p>
        )}

        <div className="mt-4">
          <Button onClick={() => void handleCreate()} loading={creating}>
            <Plus size={14} strokeWidth={2} />
            Create login
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing logins</CardTitle>
          <CardDescription>Everyone who can currently sign in to this system.</CardDescription>
        </CardHeader>

        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-text-muted">No logins found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Users size={14} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.full_name}</p>
                    <p className="text-xs text-text-muted truncate">{u.email}</p>
                  </div>
                </div>
                <span className="text-xs text-text-muted shrink-0">
                  Added {DATE_FMT.format(new Date(u.created_at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
