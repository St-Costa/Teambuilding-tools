import { create } from "zustand";
import type {
  Ambientazione,
  Annotazione,
  Crop,
  Oggetto,
  Personaggio,
  Posizione,
  TipoAnnotazione,
} from "../lib/ambientazione";
import { DIM_ANNOTAZIONE_MAX, DIM_ANNOTAZIONE_MIN } from "../lib/ambientazione";
import {
  apriAmbientazione,
  copiaAudioInCartella,
  copiaImmagineInCartella,
  copiaPresentazioneInCartella,
  creaAmbientazione,
  salvaAmbientazione,
} from "../lib/storage";
import { aggiungiRecente, aggiornaNomeRecente } from "../lib/recents";
import { EVT, emit, type ScenaPayload } from "../lib/events";
import {
  clamp01,
  nuovoId,
  DIM_ANNOTAZIONE_SIMBOLO_DEFAULT,
  DIM_ANNOTAZIONE_TESTO_DEFAULT,
} from "../lib/scena";
import { leggiSnapshot } from "./snapshotProviders";
// Le funzioni di registrazione dei provider vivono in ./snapshotProviders ma
// vengono ri-esportate qui: gli altri store le importano da "./ambientazioneStore"
// (API pubblica invariata) per registrarsi al proprio boot.
export {
  registraConflittoSnapshotProvider,
  registraTimerSnapshotProvider,
  registraLeaderboardSnapshotProvider,
  registraVittoriaSnapshotProvider,
  registraPresentazioneSnapshotProvider,
  registraVotiSnapshotProvider,
  registraPrigionieroSnapshotProvider,
} from "./snapshotProviders";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
export type ModalitaAmbientazione = "play" | "edit";

interface AmbientazioneState {
  current: Ambientazione | null;
  folderPath: string | null;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  lastError: string | null;
  selezionatoId: string | null;
  annotazioneSelezionataId: string | null;
  annotazioneInModificaId: string | null;
  modalita: ModalitaAmbientazione;
  immagineFissaVisibile: boolean;
  countdownFullscreenVisibile: boolean;
  apri: (folderPath: string, modalita?: ModalitaAmbientazione) => Promise<void>;
  creaNuova: (folderParent: string, nome: string) => Promise<void>;
  chiudi: () => Promise<void>;
  modifica: (fn: (draft: Ambientazione) => void) => void;
  impostaMappa: (sourceAbsPath: string) => Promise<void>;
  rimuoviMappa: () => void;
  aggiungiPersonaggio: (input: {
    sourceImgPath: string;
    nome: string;
    colore: string;
    crop: Crop;
    npc?: boolean;
  }) => Promise<string>;
  spostaPersonaggio: (id: string, pos: Posizione) => void;
  rinominaPersonaggio: (id: string, nome: string) => void;
  cambiaColorePersonaggio: (id: string, hex: string) => void;
  modificaCropPersonaggio: (id: string, crop: Crop) => void;
  impostaNpcPersonaggio: (id: string, npc: boolean) => void;
  salvaPosizioneInizialePersonaggio: (id: string) => void;
  ripristinaPosizioneInizialePersonaggio: (id: string) => void;
  eliminaPosizioneInizialePersonaggio: (id: string) => void;
  salvaTuttePosizioniIniziali: () => void;
  ripristinaTuttePosizioniIniziali: () => void;
  setLeaderboardOrdine: (ordine: string[]) => void;
  setObiettivo: (indice: 0 | 1 | 2, testo: string) => void;
  setSoundboardEmoji: (indice: number, emoji: string) => void;
  setSoundboardAudio: (indice: number, sourceAbsPath: string | null) => Promise<void>;
  setSottofondo: (sourceAbsPath: string | null) => Promise<void>;
  impostaImmagineFissa: (sourceAbsPath: string | null) => Promise<void>;
  setImmagineFissaVisibile: (v: boolean) => void;
  impostaSfondoCountdown: (sourceAbsPath: string | null) => Promise<void>;
  setCountdownFullscreenVisibile: (v: boolean) => void;
  impostaSfondoVoti: (sourceAbsPath: string | null) => Promise<void>;
  impostaSfondoPrigioniero: (sourceAbsPath: string | null) => Promise<void>;
  impostaSuonoPrigioniero: (sourceAbsPath: string | null) => Promise<void>;
  impostaSuonoPrigionieroSting: (sourceAbsPath: string | null) => Promise<void>;
  impostaSuonoPrigionieroSirena: (sourceAbsPath: string | null) => Promise<void>;
  impostaPresentazione: (sourceAbsPath: string) => Promise<void>;
  rimuoviPresentazione: () => void;
  setNotaPagina: (pagina: number, testo: string) => void;
  eliminaPersonaggio: (id: string) => void;
  selezionaPersonaggio: (id: string | null) => void;
  aggiungiAnnotazione: (input: {
    tipo: TipoAnnotazione;
    contenuto: string;
    colore?: string | null;
  }) => string;
  spostaAnnotazione: (id: string, pos: Posizione) => void;
  ridimensionaAnnotazione: (id: string, dimensione: number) => void;
  modificaTestoAnnotazione: (id: string, contenuto: string) => void;
  cambiaColoreAnnotazione: (id: string, hex: string | null) => void;
  eliminaAnnotazione: (id: string) => void;
  selezionaAnnotazione: (id: string | null) => void;
  setAnnotazioneInModifica: (id: string | null) => void;
  aggiungiOggetto: (input: { sourceImgPath: string; nome: string; crop: Crop }) => Promise<string>;
  rinominaOggetto: (id: string, nome: string) => void;
  modificaCropOggetto: (id: string, crop: Crop) => void;
  eliminaOggetto: (id: string) => void;
  assegnaOggettoAPersonaggio: (personaggioId: string, oggettoId: string | null) => void;
  markSaving: () => void;
  markSaved: (a: Ambientazione) => void;
  markError: (msg: string) => void;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

let pendingEmit = false;
let lastPayload: ScenaPayload | null = null;

function emitThrottled(payload: ScenaPayload): void {
  lastPayload = payload;
  if (pendingEmit) return;
  pendingEmit = true;
  requestAnimationFrame(() => {
    pendingEmit = false;
    const p = lastPayload;
    lastPayload = null;
    if (p) void emit(EVT.scenaUpdate, p).catch(() => undefined);
  });
}

function payloadCorrente(state: AmbientazioneState): ScenaPayload {
  const snap = leggiSnapshot();
  return {
    folderPath: state.folderPath,
    mappaPath: state.current?.mappaPath ?? null,
    personaggi: state.current?.personaggi ?? [],
    oggetti: state.current?.oggetti ?? [],
    annotazioni: state.current?.annotazioni ?? [],
    nome: state.current?.nome ?? null,
    conflitto: snap.conflitto,
    timer: snap.timer,
    leaderboard: snap.leaderboard,
    vittoria: snap.vittoria,
    presentazionePath: state.current?.presentazionePath ?? null,
    presentazione: snap.presentazione,
    immagineFissaPath: state.current?.immagineFissaPath ?? null,
    immagineFissaVisibile: state.immagineFissaVisibile,
    sfondoCountdownPath: state.current?.sfondoCountdownPath ?? null,
    countdownFullscreenVisibile: state.countdownFullscreenVisibile,
    voti: snap.voti,
    sfondoVotiPath: state.current?.sfondoVotiPath ?? null,
    prigionieroAnimazione: snap.prigioniero,
    sfondoPrigionieroPath: state.current?.sfondoPrigionieroPath ?? null,
  };
}

export function forceEmitScena(): void {
  emitThrottled(payloadCorrente(useAmbientazioneStore.getState()));
}

function notificaProiezione(state: AmbientazioneState): void {
  emitThrottled(payloadCorrente(state));
}

export const useAmbientazioneStore = create<AmbientazioneState>((set, get) => ({
  current: null,
  folderPath: null,
  saveStatus: "idle",
  lastSavedAt: null,
  lastError: null,
  selezionatoId: null,
  annotazioneSelezionataId: null,
  annotazioneInModificaId: null,
  modalita: "edit",
  immagineFissaVisibile: false,
  countdownFullscreenVisibile: false,

  async apri(folderPath, modalita = "edit") {
    const a = await apriAmbientazione(folderPath);
    // All'apertura, ogni personaggio con una posizione iniziale salvata viene
    // riportato lì, e l'oggetto attaccato torna a quello iniziale (anche se
    // null = nessuno). Modifica in-memory: saveStatus resta "saved" (niente
    // autosave forzato), così lo stato iniziale non viene riscritto sul disco
    // a meno che l'utente non modifichi davvero qualcosa.
    for (const p of a.personaggi) {
      if (p.posizioneIniziale) {
        p.posizione = { x: p.posizioneIniziale.x, y: p.posizioneIniziale.y };
      }
      p.oggettoId = p.oggettoInizialeId;
    }
    set({
      current: a,
      folderPath,
      saveStatus: "saved",
      lastSavedAt: Date.now(),
      lastError: null,
      selezionatoId: null,
      annotazioneSelezionataId: null,
      annotazioneInModificaId: null,
      modalita,
      immagineFissaVisibile: false,
      countdownFullscreenVisibile: false,
    });
    await aggiungiRecente(folderPath, a.nome);
    notificaProiezione(get());
  },

  async creaNuova(folderParent, nome) {
    const sep = folderParent.includes("\\") && !folderParent.includes("/") ? "\\" : "/";
    const folderPath = `${folderParent.replace(/[/\\]+$/, "")}${sep}${nome}`;
    const a = await creaAmbientazione(folderPath, nome);
    set({
      current: a,
      folderPath,
      saveStatus: "saved",
      lastSavedAt: Date.now(),
      lastError: null,
      selezionatoId: null,
      annotazioneSelezionataId: null,
      annotazioneInModificaId: null,
      modalita: "edit",
      immagineFissaVisibile: false,
      countdownFullscreenVisibile: false,
    });
    await aggiungiRecente(folderPath, nome);
    notificaProiezione(get());
  },

  async chiudi() {
    // Flush di un eventuale salvataggio in sospeso PRIMA di azzerare lo stato:
    // l'autosave è debounced (500ms), quindi le ultime modifiche fatte dal vivo
    // (tipicamente le annotazioni aggiunte in play, dove non c'è l'indicatore
    // "salvato" a dare feedback) andrebbero perse chiudendo la sessione. Qui
    // scriviamo subito su disco lo stato corrente prima di scartarlo.
    const stato = get().saveStatus;
    if (stato === "dirty" || stato === "saving") {
      await eseguiSalvataggio();
    }
    set({
      current: null,
      folderPath: null,
      saveStatus: "idle",
      lastSavedAt: null,
      lastError: null,
      selezionatoId: null,
      annotazioneSelezionataId: null,
      annotazioneInModificaId: null,
      modalita: "edit",
      immagineFissaVisibile: false,
      countdownFullscreenVisibile: false,
    });
    notificaProiezione(get());
  },

  modifica(fn) {
    const cur = get().current;
    if (!cur) return;
    const next = clone(cur);
    fn(next);
    // GIOCO EFFIMERO: in modalità "play" le modifiche (spostamenti, oggetti,
    // annotazioni) aggiornano lo stato in memoria e la proiezione, ma NON
    // marcano "dirty" → niente autosave, niente scrittura su disco. Lo scenario
    // si modifica in modo permanente solo in "edit". Così una sessione di gioco
    // non altera mai lo scenario salvato: riaprendolo torna com'era nel setup.
    const inPlay = get().modalita === "play";
    set({
      current: next,
      saveStatus: inPlay ? get().saveStatus : "dirty",
      lastError: null,
    });
    notificaProiezione(get());
  },

  async impostaMappa(sourceAbsPath) {
    const { folderPath } = get();
    if (!folderPath) throw new Error("Nessuna ambientazione aperta");
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(folderPath, sourceAbsPath, "", `mappa-${id}`);
    get().modifica((draft) => {
      draft.mappaPath = relativo;
    });
  },

  rimuoviMappa() {
    get().modifica((draft) => {
      draft.mappaPath = null;
    });
  },

  async aggiungiPersonaggio({ sourceImgPath, nome, colore, crop, npc }) {
    const { folderPath } = get();
    if (!folderPath) throw new Error("Nessuna ambientazione aperta");
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(folderPath, sourceImgPath, "personaggi", id);
    const personaggio: Personaggio = {
      id,
      nome: nome.trim(),
      colore: colore.toUpperCase(),
      imgPath: relativo,
      crop,
      posizione: { x: 0.1, y: 0.1 },
      posizioneIniziale: null,
      oggettoId: null,
      oggettoInizialeId: null,
      npc: npc ?? false,
    };
    get().modifica((draft) => {
      draft.personaggi.push(personaggio);
    });
    return id;
  },

  spostaPersonaggio(id, pos) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) {
        p.posizione = { x: clamp01(pos.x), y: clamp01(pos.y) };
      }
    });
  },

  rinominaPersonaggio(id, nome) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) p.nome = nome.trim();
    });
  },

  cambiaColorePersonaggio(id, hex) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) p.colore = hex.toUpperCase();
    });
  },

  modificaCropPersonaggio(id, crop) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) p.crop = crop;
    });
  },

  impostaNpcPersonaggio(id, npc) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) p.npc = npc;
    });
  },

  salvaPosizioneInizialePersonaggio(id) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) p.posizioneIniziale = { x: p.posizione.x, y: p.posizione.y };
    });
  },

  ripristinaPosizioneInizialePersonaggio(id) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p && p.posizioneIniziale) {
        p.posizione = { x: p.posizioneIniziale.x, y: p.posizioneIniziale.y };
      }
    });
  },

  eliminaPosizioneInizialePersonaggio(id) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) p.posizioneIniziale = null;
    });
  },

  salvaTuttePosizioniIniziali() {
    get().modifica((draft) => {
      for (const p of draft.personaggi) {
        p.posizioneIniziale = { x: p.posizione.x, y: p.posizione.y };
        p.oggettoInizialeId = p.oggettoId;
      }
    });
  },

  ripristinaTuttePosizioniIniziali() {
    get().modifica((draft) => {
      for (const p of draft.personaggi) {
        if (p.posizioneIniziale) {
          p.posizione = { x: p.posizioneIniziale.x, y: p.posizioneIniziale.y };
        }
        // Ripristina anche l'oggetto iniziale (può essere null = nessun oggetto).
        p.oggettoId = p.oggettoInizialeId;
      }
    });
  },

  setLeaderboardOrdine(ordine) {
    get().modifica((draft) => {
      draft.leaderboardOrdine = ordine;
    });
  },

  setObiettivo(indice, testo) {
    get().modifica((draft) => {
      const nuovi: [string, string, string] = [
        draft.obiettivi[0],
        draft.obiettivi[1],
        draft.obiettivi[2],
      ];
      nuovi[indice] = testo;
      draft.obiettivi = nuovi;
    });
  },

  setSoundboardEmoji(indice, emoji) {
    get().modifica((draft) => {
      if (indice < 0 || indice >= draft.soundboard.length) return;
      draft.soundboard[indice].emoji = emoji;
    });
  },

  async setSoundboardAudio(indice, sourceAbsPath) {
    const { folderPath, current } = get();
    if (!folderPath || !current) throw new Error("Nessuna ambientazione aperta");
    if (indice < 0 || indice >= current.soundboard.length) return;
    if (sourceAbsPath === null) {
      get().modifica((draft) => {
        draft.soundboard[indice].audioPath = null;
      });
      return;
    }
    const slotId = current.soundboard[indice].id;
    const relativo = await copiaAudioInCartella(folderPath, sourceAbsPath, "audio", slotId);
    get().modifica((draft) => {
      draft.soundboard[indice].audioPath = relativo;
    });
  },

  async setSottofondo(sourceAbsPath) {
    const { folderPath, current } = get();
    if (!folderPath || !current) throw new Error("Nessuna ambientazione aperta");
    if (sourceAbsPath === null) {
      get().modifica((draft) => {
        draft.sottofondoPath = null;
      });
      return;
    }
    const relativo = await copiaAudioInCartella(folderPath, sourceAbsPath, "audio", "sottofondo");
    get().modifica((draft) => {
      draft.sottofondoPath = relativo;
    });
  },

  async impostaImmagineFissa(sourceAbsPath) {
    const { folderPath, current } = get();
    if (!folderPath || !current) throw new Error("Nessuna ambientazione aperta");
    if (sourceAbsPath === null) {
      get().modifica((draft) => {
        draft.immagineFissaPath = null;
      });
      return;
    }
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(
      folderPath,
      sourceAbsPath,
      "",
      `immagine-fissa-${id}`,
    );
    get().modifica((draft) => {
      draft.immagineFissaPath = relativo;
    });
  },

  setImmagineFissaVisibile(v) {
    set({ immagineFissaVisibile: v });
    notificaProiezione(get());
  },

  async impostaSfondoCountdown(sourceAbsPath) {
    const { folderPath, current } = get();
    if (!folderPath || !current) throw new Error("Nessuna ambientazione aperta");
    if (sourceAbsPath === null) {
      get().modifica((draft) => {
        draft.sfondoCountdownPath = null;
      });
      return;
    }
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(
      folderPath,
      sourceAbsPath,
      "",
      `sfondo-countdown-${id}`,
    );
    get().modifica((draft) => {
      draft.sfondoCountdownPath = relativo;
    });
  },

  setCountdownFullscreenVisibile(v) {
    set({ countdownFullscreenVisibile: v });
    notificaProiezione(get());
  },

  async impostaSfondoVoti(sourceAbsPath) {
    const { folderPath, current } = get();
    if (!folderPath || !current) throw new Error("Nessuna ambientazione aperta");
    if (sourceAbsPath === null) {
      get().modifica((draft) => {
        draft.sfondoVotiPath = null;
      });
      return;
    }
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(
      folderPath,
      sourceAbsPath,
      "",
      `sfondo-voti-${id}`,
    );
    get().modifica((draft) => {
      draft.sfondoVotiPath = relativo;
    });
  },

  async impostaSfondoPrigioniero(sourceAbsPath) {
    const { folderPath, current } = get();
    if (!folderPath || !current) throw new Error("Nessuna ambientazione aperta");
    if (sourceAbsPath === null) {
      get().modifica((draft) => {
        draft.sfondoPrigionieroPath = null;
      });
      return;
    }
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(
      folderPath,
      sourceAbsPath,
      "",
      `sfondo-prigioniero-${id}`,
    );
    get().modifica((draft) => {
      draft.sfondoPrigionieroPath = relativo;
    });
  },

  async impostaSuonoPrigioniero(sourceAbsPath) {
    const { folderPath, current } = get();
    if (!folderPath || !current) throw new Error("Nessuna ambientazione aperta");
    if (sourceAbsPath === null) {
      get().modifica((draft) => {
        draft.suonoPrigionieroPath = null;
      });
      return;
    }
    const relativo = await copiaAudioInCartella(
      folderPath,
      sourceAbsPath,
      "audio",
      `prigioniero-sbarre-${nuovoId()}`,
    );
    get().modifica((draft) => {
      draft.suonoPrigionieroPath = relativo;
    });
  },

  async impostaSuonoPrigionieroSting(sourceAbsPath) {
    const { folderPath, current } = get();
    if (!folderPath || !current) throw new Error("Nessuna ambientazione aperta");
    if (sourceAbsPath === null) {
      get().modifica((draft) => {
        draft.suonoPrigionieroStingPath = null;
      });
      return;
    }
    const relativo = await copiaAudioInCartella(
      folderPath,
      sourceAbsPath,
      "audio",
      `prigioniero-sting-${nuovoId()}`,
    );
    get().modifica((draft) => {
      draft.suonoPrigionieroStingPath = relativo;
    });
  },

  async impostaSuonoPrigionieroSirena(sourceAbsPath) {
    const { folderPath, current } = get();
    if (!folderPath || !current) throw new Error("Nessuna ambientazione aperta");
    if (sourceAbsPath === null) {
      get().modifica((draft) => {
        draft.suonoPrigionieroSirenaPath = null;
      });
      return;
    }
    const relativo = await copiaAudioInCartella(
      folderPath,
      sourceAbsPath,
      "audio",
      `prigioniero-sirena-${nuovoId()}`,
    );
    get().modifica((draft) => {
      draft.suonoPrigionieroSirenaPath = relativo;
    });
  },

  async impostaPresentazione(sourceAbsPath) {
    const { folderPath } = get();
    if (!folderPath) throw new Error("Nessuna ambientazione aperta");
    const relativo = await copiaPresentazioneInCartella(folderPath, sourceAbsPath, nuovoId());
    get().modifica((draft) => {
      // Cambiando PDF le vecchie note non hanno più senso (pagine diverse).
      draft.presentazionePath = relativo;
      draft.notePresentazione = {};
    });
  },

  rimuoviPresentazione() {
    get().modifica((draft) => {
      draft.presentazionePath = null;
      draft.notePresentazione = {};
    });
  },

  setNotaPagina(pagina, testo) {
    get().modifica((draft) => {
      if (testo.trim() === "") {
        delete draft.notePresentazione[pagina];
      } else {
        draft.notePresentazione[pagina] = testo;
      }
    });
  },

  eliminaPersonaggio(id) {
    get().modifica((draft) => {
      draft.personaggi = draft.personaggi.filter((x) => x.id !== id);
    });
    if (get().selezionatoId === id) set({ selezionatoId: null });
  },

  selezionaPersonaggio(id) {
    // Selezionare un personaggio deseleziona l'eventuale annotazione attiva,
    // per non avere due maniglie/handle attivi insieme.
    set({
      selezionatoId: id,
      annotazioneSelezionataId: id ? null : get().annotazioneSelezionataId,
    });
  },

  aggiungiAnnotazione({ tipo, contenuto, colore }) {
    const id = nuovoId();
    const annotazione: Annotazione = {
      id,
      tipo,
      contenuto,
      // Posizione iniziale al centro, leggermente sfalsata per ogni nuova
      // annotazione così non si impilano esattamente sovrapposte.
      posizione: { x: 0.5, y: 0.5 },
      dimensione:
        tipo === "simbolo" ? DIM_ANNOTAZIONE_SIMBOLO_DEFAULT : DIM_ANNOTAZIONE_TESTO_DEFAULT,
      colore: colore ?? null,
    };
    get().modifica((draft) => {
      // Sfalsa leggermente in base a quante annotazioni esistono già.
      const n = draft.annotazioni.length;
      const off = clamp01(0.5 + ((n % 5) - 2) * 0.04);
      annotazione.posizione = { x: off, y: clamp01(0.5 + (Math.floor(n / 5) % 5) * 0.04) };
      draft.annotazioni.push(annotazione);
    });
    set({ annotazioneSelezionataId: id, selezionatoId: null });
    return id;
  },

  spostaAnnotazione(id, pos) {
    get().modifica((draft) => {
      const a = draft.annotazioni.find((x) => x.id === id);
      if (a) a.posizione = { x: clamp01(pos.x), y: clamp01(pos.y) };
    });
  },

  ridimensionaAnnotazione(id, dimensione) {
    const dim = Math.min(DIM_ANNOTAZIONE_MAX, Math.max(DIM_ANNOTAZIONE_MIN, dimensione));
    get().modifica((draft) => {
      const a = draft.annotazioni.find((x) => x.id === id);
      if (a) a.dimensione = dim;
    });
  },

  modificaTestoAnnotazione(id, contenuto) {
    get().modifica((draft) => {
      const a = draft.annotazioni.find((x) => x.id === id);
      if (a) a.contenuto = contenuto;
    });
  },

  cambiaColoreAnnotazione(id, hex) {
    get().modifica((draft) => {
      const a = draft.annotazioni.find((x) => x.id === id);
      if (a) a.colore = hex ? hex.toUpperCase() : null;
    });
  },

  eliminaAnnotazione(id) {
    get().modifica((draft) => {
      draft.annotazioni = draft.annotazioni.filter((x) => x.id !== id);
    });
    const patch: Partial<AmbientazioneState> = {};
    if (get().annotazioneSelezionataId === id) patch.annotazioneSelezionataId = null;
    if (get().annotazioneInModificaId === id) patch.annotazioneInModificaId = null;
    if (Object.keys(patch).length) set(patch);
  },

  selezionaAnnotazione(id) {
    // Cambiare selezione chiude l'eventuale modifica inline in corso.
    set({
      annotazioneSelezionataId: id,
      selezionatoId: id ? null : get().selezionatoId,
      annotazioneInModificaId: null,
    });
  },

  setAnnotazioneInModifica(id) {
    // Entrare in modifica implica selezionare l'annotazione (e deselezionare
    // l'eventuale personaggio).
    set({
      annotazioneInModificaId: id,
      annotazioneSelezionataId: id ?? get().annotazioneSelezionataId,
      selezionatoId: id ? null : get().selezionatoId,
    });
  },

  async aggiungiOggetto({ sourceImgPath, nome, crop }) {
    const { folderPath } = get();
    if (!folderPath) throw new Error("Nessuna ambientazione aperta");
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(folderPath, sourceImgPath, "oggetti", id);
    const oggetto: Oggetto = {
      id,
      nome: nome.trim(),
      imgPath: relativo,
      crop,
    };
    get().modifica((draft) => {
      draft.oggetti.push(oggetto);
    });
    return id;
  },

  rinominaOggetto(id, nome) {
    get().modifica((draft) => {
      const o = draft.oggetti.find((x) => x.id === id);
      if (o) o.nome = nome.trim();
    });
  },

  modificaCropOggetto(id, crop) {
    get().modifica((draft) => {
      const o = draft.oggetti.find((x) => x.id === id);
      if (o) o.crop = crop;
    });
  },

  eliminaOggetto(id) {
    get().modifica((draft) => {
      draft.oggetti = draft.oggetti.filter((x) => x.id !== id);
      // Detach automatico dai personaggi che lo avevano.
      for (const p of draft.personaggi) {
        if (p.oggettoId === id) p.oggettoId = null;
      }
    });
  },

  assegnaOggettoAPersonaggio(personaggioId, oggettoId) {
    get().modifica((draft) => {
      // Vincolo 1-a-1: l'oggetto può essere su un solo personaggio.
      // Se viene riassegnato, libera l'eventuale precedente proprietario.
      if (oggettoId !== null) {
        for (const p of draft.personaggi) {
          if (p.id !== personaggioId && p.oggettoId === oggettoId) {
            p.oggettoId = null;
          }
        }
      }
      const target = draft.personaggi.find((x) => x.id === personaggioId);
      if (target) target.oggettoId = oggettoId;
    });
  },

  markSaving() {
    set({ saveStatus: "saving" });
  },

  markSaved(a) {
    set({
      current: a,
      saveStatus: "saved",
      lastSavedAt: Date.now(),
      lastError: null,
    });
  },

  markError(msg) {
    set({ saveStatus: "error", lastError: msg });
  },
}));

export async function eseguiSalvataggio(): Promise<void> {
  const { current, folderPath, markSaving, markSaved, markError } =
    useAmbientazioneStore.getState();
  if (!current || !folderPath) return;
  markSaving();
  try {
    const aggiornata = await salvaAmbientazione(folderPath, current);
    markSaved(aggiornata);
    if (aggiornata.nome) {
      await aggiornaNomeRecente(folderPath, aggiornata.nome);
    }
  } catch (e) {
    markError(e instanceof Error ? e.message : String(e));
  }
}
