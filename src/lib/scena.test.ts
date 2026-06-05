import { describe, it, expect } from "vitest";
import {
  clamp01,
  fontSizeAnnotazione,
  dimensioneCerchietto,
  rettangoloContain,
  FRAZIONE_CERCHIETTO,
} from "./scena";

describe("clamp01", () => {
  it("limita all'intervallo [0,1]", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });
});

describe("fontSizeAnnotazione", () => {
  it("è la frazione del lato maggiore arrotondata", () => {
    expect(fontSizeAnnotazione(0.06, 1000)).toBe(60);
    expect(fontSizeAnnotazione(0.045, 800)).toBe(36);
    expect(fontSizeAnnotazione(0.0451, 1000)).toBe(45); // arrotonda
  });
});

describe("dimensioneCerchietto", () => {
  it("usa il lato maggiore del rettangolo per la frazione del cerchietto", () => {
    const rett = { larghezza: 1000, altezza: 500, offsetX: 0, offsetY: 0 };
    expect(dimensioneCerchietto(rett)).toBe(Math.round(1000 * FRAZIONE_CERCHIETTO));
  });
});

describe("rettangoloContain", () => {
  it("ritorna tutto a zero con dimensioni non valide", () => {
    expect(rettangoloContain(0, 100, 100, 100)).toEqual({
      larghezza: 0,
      altezza: 0,
      offsetX: 0,
      offsetY: 0,
    });
    expect(rettangoloContain(100, 100, -1, 100).larghezza).toBe(0);
  });

  it("centra orizzontalmente quando il contenuto è più stretto (letterbox laterale)", () => {
    // contenuto quadrato in contenitore wide: scala su altezza, banda ai lati.
    const r = rettangoloContain(100, 100, 400, 200);
    expect(r.larghezza).toBe(200);
    expect(r.altezza).toBe(200);
    expect(r.offsetX).toBe(100); // (400-200)/2
    expect(r.offsetY).toBe(0);
  });

  it("centra verticalmente quando il contenuto è più largo (letterbox sopra/sotto)", () => {
    const r = rettangoloContain(200, 100, 200, 400);
    expect(r.larghezza).toBe(200);
    expect(r.altezza).toBe(100);
    expect(r.offsetX).toBe(0);
    expect(r.offsetY).toBe(150); // (400-100)/2
  });

  it("mantiene l'aspect ratio del contenuto", () => {
    const r = rettangoloContain(160, 90, 800, 800);
    expect(r.larghezza / r.altezza).toBeCloseTo(160 / 90, 9);
  });
});
