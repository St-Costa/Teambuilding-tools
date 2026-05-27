export interface CoreEntry {
  hex: string;
  nome: string;
}

export const PALETTE: readonly CoreEntry[] = [
  { hex: "#E53935", nome: "Rosso" },
  { hex: "#FB8C00", nome: "Arancio" },
  { hex: "#FDD835", nome: "Giallo" },
  { hex: "#43A047", nome: "Verde" },
  { hex: "#1E88E5", nome: "Blu" },
  { hex: "#5E35B1", nome: "Viola" },
  { hex: "#D81B60", nome: "Rosa" },
  { hex: "#00ACC1", nome: "Ciano" },
  { hex: "#6D4C41", nome: "Marrone" },
  { hex: "#546E7A", nome: "Ardesia" },
  { hex: "#C0CA33", nome: "Lime" },
  { hex: "#F4511E", nome: "Vermiglio" },
];

const HEX_NORMALIZZATI = PALETTE.map((c) => c.hex.toUpperCase());

export function isColoreValido(hex: string): boolean {
  return HEX_NORMALIZZATI.includes(hex.toUpperCase());
}

export function nomeColore(hex: string): string {
  const upper = hex.toUpperCase();
  return PALETTE.find((c) => c.hex.toUpperCase() === upper)?.nome ?? hex;
}

export function primoColoreLibero(usati: string[]): string | null {
  const usatiSet = new Set(usati.map((u) => u.toUpperCase()));
  for (const c of PALETTE) {
    if (!usatiSet.has(c.hex.toUpperCase())) return c.hex;
  }
  return null;
}
