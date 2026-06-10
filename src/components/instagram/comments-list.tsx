"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, AtSign, Bot } from "lucide-react";

export interface InstagramCommentSummary {
  id: string;
  ig_media_id: string;
  ig_comment_id: string;
  author_username: string | null;
  comment_text: string;
  ai_reply: string | null;
  status: "pending_review" | "approved" | "posted" | "skipped" | "failed";
  status_error: string | null;
  posted_at: string | null;
  created_at: string;
}

interface InstagramCommentsListProps {
  comments: InstagramCommentSummary[];
}

export function InstagramCommentsList({ comments }: InstagramCommentsListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
            <MessageSquare size={20} strokeWidth={1.8} className="text-foreground" />
          </div>
          <div>
            <CardTitle>Instagram Comments</CardTitle>
            <CardDescription>
              {comments.length === 0
                ? "No comments captured yet."
                : `${comments.length} comment${comments.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-3">
            <AtSign size={22} strokeWidth={1.8} className="text-text-muted" />
          </div>
          <p className="text-sm font-medium text-foreground">No comments yet</p>
          <p className="text-xs text-text-muted mt-1 max-w-md">
            Once someone comments on your posts, the comments will appear here with AI replies (if enabled).
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border -mx-6">
          {comments.map((c) => (
            <li key={c.id} className="px-6 py-3.5">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground">
                    @{c.author_username ?? "unknown"}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <span className="text-[10px] text-text-muted whitespace-nowrap pt-0.5">
                  {formatRelativeTime(c.created_at)}
                </span>
              </div>
              <p className="text-sm text-foreground mb-2">{c.comment_text}</p>
              {c.ai_reply && (
                <div className="ml-4 pl-3 border-l-2 border-primary/30 mt-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bot size={11} strokeWidth={2} className="text-primary" />
                    <span className="text-[10px] font-medium text-primary">AI reply</span>
                  </div>
                  <p className="text-xs text-text-muted">{c.ai_reply}</p>
                </div>
              )}
              {c.status_error && (
                <p className="text-xs text-error mt-1.5">⚠️ {c.status_error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: InstagramCommentSummary["status"] }) {
  const variant =
    status === "posted"
      ? "success"
      : status === "failed"
      ? "error"
      : status === "skipped"
      ? "default"
      : "processing";
  return <Badge variant={variant}>{status.replace("_", " ")}</Badge>;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
