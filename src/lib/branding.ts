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
  /** WhatsApp Green — use ONLY for WhatsApp-specific UI (avatars, unread badges, tick marks). */
  whatsapp: string;
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
  name: "SA'DA H2O",
  tagline: "The Art of Purity",
  logo: {
    url: "/logo.png",
    alt: "SA'DA H2O",
    width: 200,
    height: 128,
  },
  colors: {
    blue: "#0EA5E9",
    white: "#FFFFFF",
    darkBlue: "#0284C7",
    mediumBlue: "#7DD3FC",
    teal: "#14B8A6",
    deepNavy: "#080C14",
    lightGrey: "#F1F5F9",
    orange: "#F59E0B",
    charcoal: "#0F172A",
  },
  semantic: {
    primary: "#0EA5E9",
    primaryHover: "#38BDF8",
    primaryMuted: "#7DD3FC",
    background: "#080C14",
    surface: "#111A2B",
    surfaceElevated: "#141B2D",
    text: "#F1F5F9",
    textMuted: "#94A3B8",
    border: "#1E293B",
    success: "#2DD4BF",
    warning: "#FBBF24",
    error: "#F87171",
    whatsapp: "#25D366",
  },
  fonts: {
    heading: "var(--font-playfair)",
    body: "var(--font-inter)",
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
