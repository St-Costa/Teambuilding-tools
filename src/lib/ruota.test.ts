import { describe, it, expect } from "vitest";
import {
  calcolaFette,
  scegliVincitorePesato,
  angoloDiArresto,
  type PartecipanteInput,
} from "./ruota";

const ARROTONDA = 1e-9;

/** Sequenza deterministica di valori per simulare Math.random nei test. */
function randSeq(valori: number[]): () => number {
  let i = 0;
  return () => valori[i++ % valori.length];
}

describe("calcolaFette", () => {
  it("ritorna [] per nessun partecipante", () => {
    expect(calcolaFette([])).toEqual([]);
  });

  it("dà una sola fetta piena (360°) con un partecipante", () => {
    const fette = calcolaFette([{ id: "a", modificatore: null }]);
    expect(fette).toHaveLength(1);
    expect(fette[0].totaleFrazione).toBeCloseTo(1, 12);
    expect(fette[0].startAngolo).toBeCloseTo(0, 12);
    expect(fette[0].fineAngolo).toBeCloseTo(360, 12);
    expect(fette[0].bonusFrazione).toBeCloseTo(0, 12);
  });

  it("ripartisce in parti uguali senza modificatori", () => {
    for (const n of [2, 3, 4, 5]) {
      const input: PartecipanteInput[] = Array.from({ length: n }, (_, i) => ({
        id: `p${i}`,
        modificatore: null,
      }));
      const fette = calcolaFette(input);
      for (const f of fette) {
        expect(f.totaleFrazione).toBeCloseTo(1 / n, 12);
        expect(f.bonusFrazione).toBeCloseTo(0, 12);
      }
    }
  });

  it("la somma delle frazioni è sempre 1 (cerchio pieno)", () => {
    const casi: PartecipanteInput[][] = [
      [
        { id: "a", modificatore: "+1" },
        { id: "b", modificatore: null },
      ],
      [
        { id: "a", modificatore: "+2" },
        { id: "b", modificatore: "+1" },
        { id: "c", modificatore: null },
      ],
      [
        { id: "a", modificatore: "+2" },
        { id: "b", modificatore: "+2" },
        { id: "c", modificatore: "+2" },
        { id: "d", modificatore: "+2" },
      ],
    ];
    for (const input of casi) {
      const fette = calcolaFette(input);
      const somma = fette.reduce((acc, f) => acc + f.totaleFrazione, 0);
      expect(somma).toBeCloseTo(1, 12);
    }
  });

  it("applica +1 = +0.20 e +2 = +0.40 ASSOLUTI prima della rinormalizzazione", () => {
    // 2 partecipanti, base 0.5 ciascuno. A ha +1 → grezzo 0.7, B → 0.5.
    // S = 1.2. totaleFrazione: A = 0.7/1.2, B = 0.5/1.2.
    const fette = calcolaFette([
      { id: "a", modificatore: "+1" },
      { id: "b", modificatore: null },
    ]);
    const a = fette.find((f) => f.id === "a")!;
    const b = fette.find((f) => f.id === "b")!;
    expect(a.totaleFrazione).toBeCloseTo(0.7 / 1.2, 12);
    expect(b.totaleFrazione).toBeCloseTo(0.5 / 1.2, 12);
    // base e bonus rinormalizzati con lo stesso fattore S.
    expect(a.baseFrazione).toBeCloseTo(0.5 / 1.2, 12);
    expect(a.bonusFrazione).toBeCloseTo(0.2 / 1.2, 12);
    expect(a.baseFrazione + a.bonusFrazione).toBeCloseTo(a.totaleFrazione, 12);
  });

  it("l'incremento assoluto è indipendente dal numero di partecipanti", () => {
    // 3 partecipanti, base 1/3. A ha +2 → grezzo 1/3 + 0.4.
    const fette = calcolaFette([
      { id: "a", modificatore: "+2" },
      { id: "b", modificatore: null },
      { id: "c", modificatore: null },
    ]);
    const S = 1 + 0.4; // somma grezzi = (1/3+0.4) + 1/3 + 1/3 = 1.4
    const a = fette.find((f) => f.id === "a")!;
    expect(a.bonusFrazione).toBeCloseTo(0.4 / S, 12);
    expect(a.baseFrazione).toBeCloseTo(1 / 3 / S, 12);
  });

  it("produce angoli cumulativi contigui da 0 a 360", () => {
    const fette = calcolaFette([
      { id: "a", modificatore: "+1" },
      { id: "b", modificatore: "+2" },
      { id: "c", modificatore: null },
    ]);
    expect(fette[0].startAngolo).toBeCloseTo(0, 9);
    for (let i = 1; i < fette.length; i++) {
      expect(fette[i].startAngolo).toBeCloseTo(fette[i - 1].fineAngolo, 9);
    }
    expect(fette[fette.length - 1].fineAngolo).toBeCloseTo(360, 9);
  });

  it("la larghezza angolare è proporzionale a totaleFrazione", () => {
    const fette = calcolaFette([
      { id: "a", modificatore: "+1" },
      { id: "b", modificatore: null },
    ]);
    for (const f of fette) {
      expect(f.fineAngolo - f.startAngolo).toBeCloseTo(f.totaleFrazione * 360, 9);
    }
  });
});

describe("scegliVincitorePesato", () => {
  it("ritorna -1 con nessuna fetta", () => {
    expect(scegliVincitorePesato([])).toBe(-1);
  });

  it("rispetta i confini cumulativi delle fette", () => {
    // base uguale 0.5/0.5: r<0.5 → fetta 0, r>=0.5 → fetta 1.
    const fette = calcolaFette([
      { id: "a", modificatore: null },
      { id: "b", modificatore: null },
    ]);
    expect(scegliVincitorePesato(fette, () => 0.0)).toBe(0);
    expect(scegliVincitorePesato(fette, () => 0.49)).toBe(0);
    expect(scegliVincitorePesato(fette, () => 0.5)).toBe(1);
    expect(scegliVincitorePesato(fette, () => 0.99)).toBe(1);
  });

  it("la distribuzione su molti campioni segue i pesi", () => {
    const fette = calcolaFette([
      { id: "a", modificatore: "+1" }, // 0.7/1.2 ≈ 0.583
      { id: "b", modificatore: null }, // 0.5/1.2 ≈ 0.417
    ]);
    const N = 100_000;
    // PRNG deterministico (LCG) per un test ripetibile senza Math.random.
    let seed = 123456789;
    const rand = () => {
      seed = (1103515245 * seed + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    let conteggioA = 0;
    for (let i = 0; i < N; i++) {
      if (scegliVincitorePesato(fette, rand) === 0) conteggioA++;
    }
    expect(conteggioA / N).toBeCloseTo(0.7 / 1.2, 1); // tolleranza 0.05
  });
});

describe("angoloDiArresto", () => {
  it("dopo la rotazione il top (0°) cade DENTRO la fetta vincente", () => {
    const fette = calcolaFette([
      { id: "a", modificatore: "+1" },
      { id: "b", modificatore: "+2" },
      { id: "c", modificatore: null },
    ]);
    for (let idx = 0; idx < fette.length; idx++) {
      for (const r of [0.0, 0.25, 0.5, 0.75, 0.999]) {
        const theta = angoloDiArresto(idx, fette, { rand: randSeq([r]) });
        const f = fette[idx];
        // Dopo rotazione θ oraria, la fetta occupa [start+θ, fine+θ).
        // Il top=0 ci cade se ((-θ) mod 360) ∈ [start, fine).
        const topNellaFetta = (((-theta) % 360) + 360) % 360;
        expect(topNellaFetta).toBeGreaterThanOrEqual(f.startAngolo - ARROTONDA);
        expect(topNellaFetta).toBeLessThan(f.fineAngolo + ARROTONDA);
      }
    }
  });

  it("include i giri pieni richiesti", () => {
    const fette = calcolaFette([{ id: "a", modificatore: null }]);
    const theta = angoloDiArresto(0, fette, { giriPieni: 6, rand: () => 0.5 });
    expect(theta).toBeGreaterThanOrEqual(6 * 360);
    expect(theta).toBeLessThan(7 * 360);
  });

  it("rispetta il margine: l'offset resta lontano dagli estremi della fetta", () => {
    const fette = calcolaFette([
      { id: "a", modificatore: null },
      { id: "b", modificatore: null },
    ]);
    const width = fette[0].fineAngolo - fette[0].startAngolo;
    const margine = 0.1;
    // rand=0 → offset al margine inferiore; rand=1 → margine superiore.
    const thetaMin = angoloDiArresto(0, fette, { rand: () => 0, margineFetta: margine });
    const thetaMax = angoloDiArresto(0, fette, { rand: () => 1, margineFetta: margine });
    const offsetMin = (((-thetaMin) % 360) + 360) % 360 - fette[0].startAngolo;
    const offsetMax = (((-thetaMax) % 360) + 360) % 360 - fette[0].startAngolo;
    expect(offsetMin).toBeCloseTo(width * margine, 6);
    expect(offsetMax).toBeCloseTo(width * (1 - margine), 6);
  });

  it("ritorna un angolo neutro (solo giri) per indice fuori range", () => {
    const fette = calcolaFette([{ id: "a", modificatore: null }]);
    expect(angoloDiArresto(-1, fette, { giriPieni: 6 })).toBe(6 * 360);
    expect(angoloDiArresto(5, fette, { giriPieni: 6 })).toBe(6 * 360);
  });
});
