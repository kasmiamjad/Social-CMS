interface MessagePlusIconProps {
  size?: number;
  className?: string;
}

/** "Add follow-up" icon — a chat bubble with a plus, not in lucide-react's set. */
export function MessagePlusIcon({ size = 16, className }: MessagePlusIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path d="M0 0h24v24H0z" fill="none" />
      <path
        fill="currentColor"
        d="M21 3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.455L2 22.5V4a1 1 0 0 1 1-1zm-1 2H4v13.385L5.763 17H20zm-3 2v8h-2V7zm-6 1v1.999L13 10v2l-2-.001V14H9v-2.001L7 12v-2l2-.001V8z"
      />
    </svg>
  );
}
