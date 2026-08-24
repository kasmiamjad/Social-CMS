import { User } from "lucide-react";

interface ContactAvatarProps {
  name: string | null;
  size?: number;
  className?: string;
}

/** Circular WhatsApp-green initials avatar — falls back to a generic contact icon when there's no name yet. */
export function ContactAvatar({ name, size = 40, className = "" }: ContactAvatarProps) {
  const trimmed = name?.trim();
  const initial = trimmed ? trimmed[0].toUpperCase() : null;

  return (
    <div
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full bg-whatsapp/15 text-whatsapp flex items-center justify-center font-semibold ${className}`}
    >
      {initial ? (
        <span style={{ fontSize: size * 0.4 }}>{initial}</span>
      ) : (
        <User size={size * 0.5} strokeWidth={1.8} />
      )}
    </div>
  );
}
