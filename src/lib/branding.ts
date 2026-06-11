export type LogoVariant = "dark" | "light" | "blue";

export interface LogoConfig {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface SemanticColors {
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface BrandingConfig {
  name: string;
  tagline: string;
  logo: LogoConfig;
  colors: {
    blue: string;
    white: string;
    darkBlue: string;
    mediumBlue: string;
    teal: string;
    deepNavy: string;
    lightGrey: string;
    orange: string;
    charcoal: string;
  };
  semantic: SemanticColors;
  fonts: {
    heading: string;
    body: string;
    code: string;
  };
  typography: {
    h1: { fontSize: string; fontWeight: number; letterSpacing: string };
    h2: { fontSize: string; fontWeight: number; letterSpacing: string };
    h3: { fontSize: string; fontWeight: number; letterSpacing: string };
    body: { fontSize: string; fontWeight: number };
    small: { fontSize: string; fontWeight: number };
    code: { fontSize: string; fontWeight: number };
  };
  button: {
    borderRadius: string;
    fontWeight: number;
    padding: string;
    fontSize: string;
  };
  icon: {
    strokeWidth: number;
    strokeLinecap: "round";
    strokeLinejoin: "round";
  };
}

export const BRANDING: BrandingConfig = {
  name: "a3sixty",
  tagline: "One Partner. Infinite Global Scale.",
  logo: {
    url: "/logo.png",
    alt: "a3sixty",
    width: 140,
    height: 40,
  },
  colors: {
    blue: "#1A56DB",
    white: "#FFFFFF",
    darkBlue: "#0B2A6B",
    mediumBlue: "#3B82F6",
    teal: "#10B981",
    deepNavy: "#0A0F1F",
    lightGrey: "#F4F5F7",
    orange: "#F97316",
    charcoal: "#111827",
  },
  semantic: {
    primary: "#1A56DB",
    primaryHover: "#0B2A6B",
    primaryMuted: "#3B82F6",
    background: "#FFFFFF",
    surface: "#F4F5F7",
    surfaceElevated: "#FFFFFF",
    text: "#0A0F1F",
    textMuted: "#6B7280",
    border: "#E5E7EB",
    success: "#10B981",
    warning: "#F97316",
    error: "#EF4444",
  },
  fonts: {
    heading: "var(--font-plus-jakarta)",
    body: "var(--font-dm-sans)",
    code: "var(--font-jetbrains-mono)",
  },
  typography: {
    h1: { fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.8px" },
    h2: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.8px" },
    h3: { fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.8px" },
    body: { fontSize: "0.9375rem", fontWeight: 400 },
    small: { fontSize: "0.8125rem", fontWeight: 400 },
    code: { fontSize: "0.875rem", fontWeight: 500 },
  },
  button: {
    borderRadius: "8px",
    fontWeight: 600,
    padding: "10px 24px",
    fontSize: "12px",
  },
  icon: {
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
};
