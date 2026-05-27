export function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export interface RettangoloContenuto {
  larghezza: number;
  altezza: number;
  offsetX: number;
  offsetY: number;
}

export function rettangoloContain(
  contenutoLarghezza: number,
  contenutoAltezza: number,
  contenitoreLarghezza: number,
  contenitoreAltezza: number,
): RettangoloContenuto {
  if (
    contenutoLarghezza <= 0 ||
    contenutoAltezza <= 0 ||
    contenitoreLarghezza <= 0 ||
    contenitoreAltezza <= 0
  ) {
    return { larghezza: 0, altezza: 0, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(
    contenitoreLarghezza / contenutoLarghezza,
    contenitoreAltezza / contenutoAltezza,
  );
  const larghezza = contenutoLarghezza * scale;
  const altezza = contenutoAltezza * scale;
  const offsetX = (contenitoreLarghezza - larghezza) / 2;
  const offsetY = (contenitoreAltezza - altezza) / 2;
  return { larghezza, altezza, offsetX, offsetY };
}
