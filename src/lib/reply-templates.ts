export interface ReplyTemplate {
  id: string;
  shortcut: string;
  message: string;
}

/**
 * If the text ends with "/query" (optionally preceded by whitespace/start of
 * string), returns that query so far. Only matches at the very end of the
 * text — i.e. while actively typing forward, matching WhatsApp Business's
 * own "/" quick-reply trigger.
 */
export function matchSlashQuery(text: string): string | null {
  const match = text.match(/(?:^|\s)\/(\S*)$/);
  return match ? match[1] : null;
}

/** Templates whose shortcut starts with the given query (case-insensitive). */
export function filterTemplates(templates: ReplyTemplate[], query: string): ReplyTemplate[] {
  const q = query.toLowerCase();
  return templates.filter((t) => t.shortcut.toLowerCase().startsWith(q));
}

/** Replaces the trailing "/query" in `text` with the chosen template's message. */
export function applyTemplate(text: string, query: string, message: string): string {
  const suffix = `/${query}`;
  if (!text.endsWith(suffix)) return message;
  return text.slice(0, text.length - suffix.length) + message;
}
