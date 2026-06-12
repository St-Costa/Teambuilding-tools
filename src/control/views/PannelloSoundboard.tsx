import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { eseguiSalvataggio, useAmbientazioneStore } from "../../state/ambientazioneStore";
import { joinPath } from "../../lib/path";
import EmojiPicker from "../../components/EmojiPicker";
import { IconaVolume } from "../../components/Icone";
import styles from "./PannelloSoundboard.module.css";

export default function PannelloSoundboard() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const setEmoji = useAmbientazioneStore((s) => s.setSoundboardEmoji);
  const setAudio = useAmbientazioneStore((s) => s.setSoundboardAudio);

  const inEdit = modalita === "edit";
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [erroreUpload, setErroreUpload] = useState<string | null>(null);

  if (!current || !folderPath) return null;

  // In play: solo slot con audio. In edit: solo slot con audio + eventuale pulsante "+".
  const slotConfigurati = current.soundboard
    .map((slot, idx) => ({ slot, idx }))
    .filter(({ slot }) => slot.audioPath !== null);

  const primoSlotVuoto = inEdit
    ? current.soundboard
        .map((slot, idx) => ({ slot, idx }))
        .find(({ slot }) => slot.audioPath === null) ?? null
    : null;

  if (slotConfigurati.length === 0 && !primoSlotVuoto) return null;

  async function suona(idx: number) {
    if (!current || !folderPath) return;
    const slot = current.soundboard[idx];
    if (!slot || !slot.audioPath) return;
    setErroreUpload(null);
    try {
      await invoke("play_soundboard_slot", {
        path: joinPath(folderPath, slot.audioPath),
        volume: 1.0,
      });
    } catch (e) {
      setErroreUpload(`Impossibile riprodurre: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function caricaAudio(idx: number) {
    setErroreUpload(null);
    try {
      const scelto = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "aac"] }],
      });
      if (typeof scelto !== "string") return;
      await setAudio(idx, scelto);
      await eseguiSalvataggio();
    } catch (e) {
      setErroreUpload(e instanceof Error ? e.message : String(e));
    }
  }

  async function rimuoviAudio(idx: number) {
    setErroreUpload(null);
    try {
      await setAudio(idx, null);
      await eseguiSalvataggio();
    } catch (e) {
      setErroreUpload(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className={styles.root}>
      <span className={styles.etichetta} title="Soundboard" aria-label="Soundboard">
        <IconaVolume dimensione={24} />
      </span>
      {erroreUpload && !inEdit && (
        <div className={styles.toastErrore} role="alert">
          {erroreUpload}
          <button
            type="button"
            className={styles.toastChiudi}
            onClick={() => setErroreUpload(null)}
            aria-label="Chiudi avviso"
          >
            ×
          </button>
        </div>
      )}
      {slotConfigurati.map(({ slot, idx }) => (
        <div key={slot.id} className={styles.slotWrap}>
          <button
            type="button"
            className={`${styles.slot} ${styles.slotPieno}`}
            onClick={() => {
              if (inEdit) {
                setEditingIdx(editingIdx === idx ? null : idx);
              } else {
                void suona(idx);
              }
            }}
            title={inEdit ? "Modifica slot" : "Riproduci suono"}
            aria-label={`Slot ${idx + 1}`}
          >
            <span className={styles.emoji}>{slot.emoji}</span>
          </button>
          {inEdit && editingIdx === idx && (
            <div className={styles.popover} onClick={(e) => e.stopPropagation()}>
              <div className={styles.popoverHeader}>
                <span>Slot {idx + 1}</span>
                <button
                  type="button"
                  className={styles.btnChiudi}
                  onClick={() => setEditingIdx(null)}
                  aria-label="Chiudi"
                >
                  ×
                </button>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Emoji</div>
                <EmojiPicker selezionata={slot.emoji} onSeleziona={(e) => setEmoji(idx, e)} />
              </div>
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Audio</div>
                <div className={styles.audioRiga}>
                  <span className={styles.audioPath} title={slot.audioPath ?? ""}>
                    {slot.audioPath?.split(/[/\\]/).pop() ?? ""}
                  </span>
                  <button
                    type="button"
                    className={styles.btnSecondario}
                    onClick={() => void caricaAudio(idx)}
                  >
                    Sostituisci
                  </button>
                  <button
                    type="button"
                    className={styles.btnRimuovi}
                    onClick={() => void rimuoviAudio(idx)}
                    title="Rimuovi l'audio (lo slot torna vuoto)"
                  >
                    Rimuovi
                  </button>
                </div>
              </div>
              <div className={styles.anteprima}>
                <button
                  type="button"
                  className={styles.btnAnteprima}
                  onClick={() => void suona(idx)}
                >
                  ▶ Ascolta
                </button>
              </div>
              {erroreUpload && <div className={styles.errore}>{erroreUpload}</div>}
            </div>
          )}
        </div>
      ))}

      {/* Pulsante "+" per aggiungere un nuovo slot (solo edit, solo se c'è un slot vuoto) */}
      {primoSlotVuoto && (
        <div className={styles.slotWrap}>
          <button
            type="button"
            className={`${styles.slot} ${styles.slotVuoto}`}
            onClick={() => setEditingIdx(
              editingIdx === primoSlotVuoto.idx ? null : primoSlotVuoto.idx
            )}
            title="Aggiungi effetto sonoro"
            aria-label="Aggiungi slot"
          >
            <span className={styles.emoji}>+</span>
          </button>
          {editingIdx === primoSlotVuoto.idx && (
            <div className={styles.popover} onClick={(e) => e.stopPropagation()}>
              <div className={styles.popoverHeader}>
                <span>Nuovo effetto</span>
                <button
                  type="button"
                  className={styles.btnChiudi}
                  onClick={() => setEditingIdx(null)}
                  aria-label="Chiudi"
                >
                  ×
                </button>
              </div>
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Emoji</div>
                <EmojiPicker
                  selezionata={primoSlotVuoto.slot.emoji}
                  onSeleziona={(e) => setEmoji(primoSlotVuoto.idx, e)}
                />
              </div>
              <div className={styles.section}>
                <div className={styles.sectionLabel}>Audio</div>
                <button
                  type="button"
                  className={styles.btnPrimario}
                  onClick={() => void caricaAudio(primoSlotVuoto.idx)}
                >
                  Carica MP3…
                </button>
              </div>
              {erroreUpload && <div className={styles.errore}>{erroreUpload}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
