/**
 * Single source of truth for the SA'DA H2O product catalog.
 *
 * Keep in sync with SADA_H2O_SYSTEM_PROMPT.md and the Product Images panel.
 * Used by the lead form (model dropdown) and the booking panel (price prefill).
 * `aliases` lists the shorter names the WhatsApp bot may store in
 * leads.product_model so price prefill still works on AI-created leads.
 */
export interface Product {
  /** Canonical catalog name stored in leads.product_model. */
  name: string;
  priceSar: number;
  aliases?: string[];
}

export const PRODUCTS: Product[] = [
  {
    name: "RO Water Dispenser (Hot/Cold)",
    priceSar: 499,
    aliases: ["Dispenser (Hot/Cold)", "RO Water Dispenser", "RO Dispenser"],
  },
  { name: "7-Stage RO Purifier", priceSar: 699, aliases: ["7-Stage RO"] },
  { name: "7-Stage RO Purifier + UV", priceSar: 999, aliases: ["7-Stage RO + UV"] },
  { name: "6-Stage Smart RO", priceSar: 1199 },
  { name: "7-Stage Smart RO", priceSar: 1299 },
];

/** Options for the model dropdown — value is the clean name, label adds price. */
export const PRODUCT_MODEL_OPTIONS = PRODUCTS.map((p) => ({
  value: p.name,
  label: `${p.name} — SAR ${p.priceSar.toLocaleString("en-US")}`,
}));

/**
 * Returns the catalog price for a stored model name, matching the canonical
 * name or any alias (case/whitespace-insensitive, with a loose contains
 * fallback). Returns null for unknown/legacy models.
 */
export function defaultPriceForModel(model: string | null | undefined): number | null {
  if (!model) return null;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const m = norm(model);

  for (const p of PRODUCTS) {
    if (norm(p.name) === m) return p.priceSar;
    if (p.aliases?.some((a) => norm(a) === m)) return p.priceSar;
  }
  // Loose fallback for minor variants ("the 7-Stage Smart RO unit").
  for (const p of PRODUCTS) {
    if (m.includes(norm(p.name)) || p.aliases?.some((a) => m.includes(norm(a)))) {
      return p.priceSar;
    }
  }
  return null;
}
