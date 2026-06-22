import { describe, it, expect } from "vitest";
import {
  validaAmbientazione,
  nuovoManifest,
  AmbientazioneCorrotta,
  validaNomePersonaggio,
  validaNomeOggetto,
  validaNome,
  oggettoDi,
  DIM_ANNOTAZIONE_MAX,
  DIM_ANNOTAZIONE_MIN,
  type Personaggio,
  type Oggetto,
} from "./ambientazione";

/** Costruisce un manifest minimo valido come oggetto raw (post-JSON.parse). */
function manifestRaw(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    nome: "Test",
    creataIl: "2026-01-01T00:00:00.000Z",
    modificataIl: "2026-01-01T00:00:00.000Z",
    mappaPath: null,
    personaggi: [],
    oggetti: [],
    ...extra,
  };
}

function personaggioRaw(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "p1",
    nome: "Alice",
    colore: "#ff0000",
    imgPath: "personaggi/p1.png",
    crop: { zoom: 1, offsetX: 0, offsetY: 0 },
    posizione: { x: 0.5, y: 0.5 },
    ...extra,
  };
}

describe("nuovoManifest", () => {
  it("crea un manifest valido che passa la validazione", () => {
    const m = nuovoManifest("Scenario X");
    expect(m.nome).toBe("Scenario X");
    expect(m.schemaVersion).toBe(1);
    expect(m.soundboard).toHaveLength(6);
    // round-trip: serializza e rivalida
    const rivalidato = validaAmbientazione(JSON.parse(JSON.stringify(m)));
    expect(rivalidato.nome).toBe("Scenario X");
  });
});

describe("validaAmbientazione — manifest validi", () => {
  it("accetta un manifest minimo", () => {
    const a = validaAmbientazione(manifestRaw());
    expect(a.personaggi).toEqual([]);
    expect(a.annotazioni).toEqual([]);
    expect(a.obiettivi).toEqual(["", "", ""]);
  });

  it("normalizza il colore del personaggio in maiuscolo", () => {
    const a = validaAmbientazione(manifestRaw({ personaggi: [personaggioRaw()] }));
    expect(a.personaggi[0].colore).toBe("#FF0000");
  });
});

describe("validaAmbientazione — backward compatibility (D-032)", () => {
  it("npc assente o non-true → false", () => {
    const a = validaAmbientazione(manifestRaw({ personaggi: [personaggioRaw()] }));
    expect(a.personaggi[0].npc).toBe(false);
    const b = validaAmbientazione(manifestRaw({ personaggi: [personaggioRaw({ npc: true })] }));
    expect(b.personaggi[0].npc).toBe(true);
  });

  it("posizioneIniziale assente → null", () => {
    const a = validaAmbientazione(manifestRaw({ personaggi: [personaggioRaw()] }));
    expect(a.personaggi[0].posizioneIniziale).toBeNull();
  });

  it("posizioneIniziale presente → conservata e clampata", () => {
    const a = validaAmbientazione(
      manifestRaw({
        personaggi: [personaggioRaw({ posizioneIniziale: { x: 1.5, y: -0.3 } })],
      }),
    );
    expect(a.personaggi[0].posizioneIniziale).toEqual({ x: 1, y: 0 });
  });

  it("annotazioni/obiettivi/soundboard assenti → default (manifest vecchi)", () => {
    const a = validaAmbientazione(manifestRaw());
    expect(a.annotazioni).toEqual([]);
    expect(a.soundboard).toHaveLength(6);
    expect(a.presentazionePath).toBeNull();
    expect(a.notePresentazione).toEqual({});
  });

  it("ripulisce oggettoId che punta a un oggetto inesistente", () => {
    const a = validaAmbientazione(
      manifestRaw({ personaggi: [personaggioRaw({ oggettoId: "non-esiste" })] }),
    );
    expect(a.personaggi[0].oggettoId).toBeNull();
  });

  it("clampa la dimensione delle annotazioni nei limiti", () => {
    const a = validaAmbientazione(
      manifestRaw({
        annotazioni: [
          {
            id: "a1",
            tipo: "simbolo",
            contenuto: "🔥",
            posizione: { x: 0.5, y: 0.5 },
            dimensione: 99,
            colore: null,
          },
          {
            id: "a2",
            tipo: "testo",
            contenuto: "ciao",
            posizione: { x: 0.5, y: 0.5 },
            dimensione: 0,
            colore: "#00ff00",
          },
        ],
      }),
    );
    expect(a.annotazioni[0].dimensione).toBe(DIM_ANNOTAZIONE_MAX);
    expect(a.annotazioni[1].dimensione).toBe(DIM_ANNOTAZIONE_MIN);
    expect(a.annotazioni[1].colore).toBe("#00FF00");
  });
});

describe("validaAmbientazione — manifest corrotti", () => {
  it("lancia se non è un oggetto", () => {
    expect(() => validaAmbientazione(null)).toThrow(AmbientazioneCorrotta);
    expect(() => validaAmbientazione("stringa")).toThrow(AmbientazioneCorrotta);
  });

  it("lancia su versione schema non supportata", () => {
    expect(() => validaAmbientazione(manifestRaw({ schemaVersion: 2 }))).toThrow(
      AmbientazioneCorrotta,
    );
  });

  it("lancia su nome mancante o vuoto", () => {
    expect(() => validaAmbientazione(manifestRaw({ nome: "   " }))).toThrow(AmbientazioneCorrotta);
  });

  it("lancia su personaggio con colore non esadecimale", () => {
    expect(() =>
      validaAmbientazione(manifestRaw({ personaggi: [personaggioRaw({ colore: "rosso" })] })),
    ).toThrow(AmbientazioneCorrotta);
  });

  it("lancia su crop con campi non numerici", () => {
    expect(() =>
      validaAmbientazione(
        manifestRaw({
          personaggi: [personaggioRaw({ crop: { zoom: "x", offsetX: 0, offsetY: 0 } })],
        }),
      ),
    ).toThrow(AmbientazioneCorrotta);
  });

  it("lancia se personaggi non è un array", () => {
    expect(() => validaAmbientazione(manifestRaw({ personaggi: {} }))).toThrow(
      AmbientazioneCorrotta,
    );
  });
});

describe("validaNomePersonaggio / validaNomeOggetto", () => {
  const personaggi: Personaggio[] = [
    {
      id: "p1",
      nome: "Alice",
      colore: "#FF0000",
      imgPath: "x.png",
      imgPrigionePath: null,
      crop: { zoom: 1, offsetX: 0, offsetY: 0 },
      posizione: { x: 0, y: 0 },
      posizioneIniziale: null,
      oggettoId: null,
      oggettoInizialeId: null,
      npc: false,
    },
  ];

  it("rifiuta nome vuoto", () => {
    expect(validaNomePersonaggio("  ", personaggi)).not.toBeNull();
  });

  it("rifiuta nome duplicato (case-insensitive)", () => {
    expect(validaNomePersonaggio("alice", personaggi)).not.toBeNull();
  });

  it("accetta lo stesso nome per il personaggio in modifica (esclusoId)", () => {
    expect(validaNomePersonaggio("Alice", personaggi, "p1")).toBeNull();
  });

  it("accetta un nome nuovo e unico", () => {
    expect(validaNomePersonaggio("Bob", personaggi)).toBeNull();
  });

  it("validaNomeOggetto rifiuta duplicati", () => {
    const oggetti: Oggetto[] = [
      { id: "o1", nome: "Spada", imgPath: "x.png", crop: { zoom: 1, offsetX: 0, offsetY: 0 } },
    ];
    expect(validaNomeOggetto("spada", oggetti)).not.toBeNull();
    expect(validaNomeOggetto("Scudo", oggetti)).toBeNull();
  });
});

describe("validaNome", () => {
  it("rifiuta caratteri non validi per i nomi cartella", () => {
    expect(validaNome("a/b")).not.toBeNull();
    expect(validaNome("nome:strano")).not.toBeNull();
    expect(validaNome("Scenario valido")).toBeNull();
  });
});

describe("oggettoDi", () => {
  const oggetti: Oggetto[] = [
    { id: "o1", nome: "Spada", imgPath: "x.png", crop: { zoom: 1, offsetX: 0, offsetY: 0 } },
  ];
  const base: Personaggio = {
    id: "p1",
    nome: "Alice",
    colore: "#FF0000",
    imgPath: "x.png",
    imgPrigionePath: null,
    crop: { zoom: 1, offsetX: 0, offsetY: 0 },
    posizione: { x: 0, y: 0 },
    posizioneIniziale: null,
    oggettoId: null,
    oggettoInizialeId: null,
    npc: false,
  };

  it("ritorna null senza oggetto assegnato", () => {
    expect(oggettoDi(base, oggetti)).toBeNull();
  });

  it("ritorna l'oggetto assegnato", () => {
    expect(oggettoDi({ ...base, oggettoId: "o1" }, oggetti)?.nome).toBe("Spada");
  });

  it("ritorna null se l'id non corrisponde", () => {
    expect(oggettoDi({ ...base, oggettoId: "o9" }, oggetti)).toBeNull();
  });
});
