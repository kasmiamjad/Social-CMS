import { useId } from "react";

/**
 * Exact icons requested for the WhatsApp/Messenger/Instagram brand marks —
 * SVG markup pulled directly from Iconify (ri:whatsapp-fill,
 * mdi:facebook-messenger, icon-park-twotone:instagram) and inlined here so
 * there's no runtime dependency or client-side icon fetch (Iconify's React
 * component fetches icon data in the browser by default, which doesn't work
 * inside this app's Server Components). Same size/className prop shape as
 * lucide-react icons so these drop into existing icon slots.
 */
interface PlatformIconProps {
  size?: number;
  /** Accepted for prop-shape compatibility with lucide-style icon slots; unused (these are filled marks, not stroked). */
  strokeWidth?: number;
  className?: string;
}

export function WhatsAppIcon({ size = 20, className }: PlatformIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12.001 2c5.523 0 10 4.477 10 10s-4.477 10-10 10a9.95 9.95 0 0 1-5.03-1.355L2.005 22l1.352-4.968A9.95 9.95 0 0 1 2.001 12c0-5.523 4.477-10 10-10M8.593 7.3l-.2.008a1 1 0 0 0-.372.1a1.3 1.3 0 0 0-.294.228c-.12.113-.188.211-.261.306A2.73 2.73 0 0 0 6.9 9.62c.002.49.13.967.33 1.413c.409.902 1.082 1.857 1.97 2.742c.214.213.424.427.65.626a9.45 9.45 0 0 0 3.84 2.046l.568.087c.185.01.37-.004.556-.013a2 2 0 0 0 .833-.231a5 5 0 0 0 .383-.22q.001.002.125-.09c.135-.1.218-.171.33-.288q.126-.13.21-.302c.078-.163.156-.474.188-.733c.024-.198.017-.306.014-.373c-.004-.107-.093-.218-.19-.265l-.582-.261s-.87-.379-1.402-.621a.5.5 0 0 0-.176-.041a.48.48 0 0 0-.378.127c-.005-.002-.072.055-.795.931a.35.35 0 0 1-.368.13a1.4 1.4 0 0 1-.191-.066c-.124-.052-.167-.072-.252-.108a6 6 0 0 1-1.575-1.003c-.126-.11-.243-.23-.363-.346a6.3 6.3 0 0 1-1.02-1.268l-.059-.095a1 1 0 0 1-.102-.205c-.038-.147.061-.265.061-.265s.243-.266.356-.41c.11-.14.203-.276.263-.373c.118-.19.155-.385.093-.536q-.42-1.026-.868-2.041c-.059-.134-.234-.23-.393-.249q-.081-.01-.162-.016a3 3 0 0 0-.403.004z" />
    </svg>
  );
}

export function MessengerIcon({ size = 20, className }: PlatformIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17c.16.13.26.35.27.57l.05 1.78c.04.57.61.94 1.13.71l1.98-.87c.17-.06.36-.09.53-.06c.9.27 1.9.4 2.9.4c5.64 0 10-4.13 10-9.7S17.64 2 12 2m6 7.46l-2.93 4.67c-.47.73-1.47.92-2.17.37l-2.34-1.73a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.33-.97-.17-.68-.63l2.93-4.67c.47-.73 1.47-.92 2.17-.4l2.34 1.76a.6.6 0 0 0 .72 0l3.16-2.4c.42-.33.97.17.68.63" />
    </svg>
  );
}

export function InstagramIcon({ size = 20, className }: PlatformIconProps) {
  const maskId = useId();
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 48 48" className={className}>
      <defs>
        <mask id={maskId}>
          <g fill="none">
            <path fill="#555" stroke="#fff" strokeLinejoin="round" strokeWidth="4" d="M34 6H14a8 8 0 0 0-8 8v20a8 8 0 0 0 8 8h20a8 8 0 0 0 8-8V14a8 8 0 0 0-8-8Z" />
            <path fill="#555" stroke="#fff" strokeLinejoin="round" strokeWidth="4" d="M24 32a8 8 0 1 0 0-16a8 8 0 0 0 0 16Z" />
            <path fill="#fff" d="M35 15a2 2 0 1 0 0-4a2 2 0 0 0 0 4" />
          </g>
        </mask>
      </defs>
      <path fill="currentColor" d="M0 0h48v48H0z" mask={`url(#${maskId})`} />
    </svg>
  );
}
