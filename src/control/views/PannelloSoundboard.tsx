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

  const slotVisibili = current.soundboard
    .map((slot, idx) => ({ slot, idx }))
    .filter(({ slot }) => inEdit || slot.audioPath !== null);

  if (slotVisibili.length === 0) return null;

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
      {slotVisibili.map(({ slot, idx }) => {
        const haAudio = slot.audioPath !== null;
        const cliccabile = inEdit || haAudio;
        return (
          <div key={slot.id} className={styles.slotWrap}>
            <button
              type="button"
              className={`${styles.slot} ${haAudio ? styles.slotPieno : styles.slotVuoto}`}
              onClick={() => {
                if (inEdit) {
                  setEditingIdx(editingIdx === idx ? null : idx);
                } else if (haAudio) {
                  void suona(idx);
                }
              }}
              disabled={!cliccabile}
              title={
                inEdit
                  ? haAudio
                    ? "Modifica slot"
                    : "Configura slot"
                  : haAudio
                    ? "Riproduci suono"
                    : "Slot vuoto"
              }
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
                  {haAudio ? (
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
                  ) : (
                    <button
                      type="button"
                      className={styles.btnPrimario}
                      onClick={() => void caricaAudio(idx)}
                    >
                      Carica MP3…
                    </button>
                  )}
                </div>
                {haAudio && (
                  <div className={styles.anteprima}>
                    <button
                      type="button"
                      className={styles.btnAnteprima}
                      onClick={() => void suona(idx)}
                    >
                      ▶ Ascolta
                    </button>
                  </div>
                )}
                {erroreUpload && <div className={styles.errore}>{erroreUpload}</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
