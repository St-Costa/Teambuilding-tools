import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { eseguiSalvataggio, useAmbientazioneStore } from "../../state/ambientazioneStore";
import { useVotiStore } from "../../state/votiStore";
import { IconaVoto } from "../../components/Icone";
import styles from "./PulsanteVoti.module.css";
import stylesConfig from "./PulsanteVotiConfig.module.css";

interface Props {
  numeroBadge?: number;
}

export default function PulsanteVoti({ numeroBadge }: Props) {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const impostaSfondoVoti = useAmbientazioneStore((s) => s.impostaSfondoVoti);
  const impostaSfondoPrigioniero = useAmbientazioneStore((s) => s.impostaSfondoPrigioniero);
  const impostaSuonoPrigioniero = useAmbientazioneStore((s) => s.impostaSuonoPrigioniero);
  const impostaSuonoPrigionieroSting = useAmbientazioneStore((s) => s.impostaSuonoPrigionieroSting);
  const impostaSuonoPrigionieroSirena = useAmbientazioneStore(
    (s) => s.impostaSuonoPrigionieroSirena,
  );

  const fase = useVotiStore((s) => s.fase);
  const apri = useVotiStore((s) => s.apri);
  const chiudi = useVotiStore((s) => s.chiudi);

  const [mostraConfig, setMostraConfig] = useState(false);

  const inEdit = modalita === "edit";
  const sfondoVotiPath = current?.sfondoVotiPath ?? null;
  const sfondoPrigionieroPath = current?.sfondoPrigionieroPath ?? null;
  const suonoPrigionieroPath = current?.suonoPrigionieroPath ?? null;
  const suonoPrigionieroStingPath = current?.suonoPrigionieroStingPath ?? null;
  const suonoPrigionieroSirenaPath = current?.suonoPrigionieroSirenaPath ?? null;
  const haSfondoVoti = sfondoVotiPath !== null;
  const aperta = fase === "aperta";

  // Quanti asset prigioniero sono configurati (0-4)
  const nConfigurati = [
    sfondoPrigionieroPath,
    suonoPrigionieroPath,
    suonoPrigionieroStingPath,
    suonoPrigionieroSirenaPath,
  ].filter(Boolean).length;

  if (!current || !folderPath) return null;

  // Modalità modifica: click apre il pannello di configurazione voti/prigioniero
  if (inEdit) {
    async function caricaSfondoVoti() {
      try {
        const scelto = await open({
          multiple: false,
          filters: [{ name: "Immagini", extensions: ["png", "jpg", "jpeg", "webp"] }],
        });
        if (typeof scelto !== "string") return;
        await impostaSfondoVoti(scelto);
        await eseguiSalvataggio();
      } catch {
        /* annullato */
      }
    }

    async function caricaSfondoPrigioniero() {
      try {
        const scelto = await open({
          multiple: false,
          filters: [{ name: "Immagini", extensions: ["png", "jpg", "jpeg", "webp"] }],
        });
        if (typeof scelto !== "string") return;
        await impostaSfondoPrigioniero(scelto);
        await eseguiSalvataggio();
      } catch {
        /* annullato */
      }
    }

    async function caricaSuonoSbarre() {
      try {
        const scelto = await open({
          multiple: false,
          filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "aac"] }],
        });
        if (typeof scelto !== "string") return;
        await impostaSuonoPrigioniero(scelto);
        await eseguiSalvataggio();
      } catch {
        /* annullato */
      }
    }

    async function caricaSuonoSting() {
      try {
        const scelto = await open({
          multiple: false,
          filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "aac"] }],
        });
        if (typeof scelto !== "string") return;
        await impostaSuonoPrigionieroSting(scelto);
        await eseguiSalvataggio();
      } catch {
        /* annullato */
      }
    }

    async function caricaSuonoSirena() {
      try {
        const scelto = await open({
          multiple: false,
          filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "aac"] }],
        });
        if (typeof scelto !== "string") return;
        await impostaSuonoPrigionieroSirena(scelto);
        await eseguiSalvataggio();
      } catch {
        /* annullato */
      }
    }

    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className={`${styles.btnIcona} ${haSfondoVoti || nConfigurati > 0 ? styles.configurato : styles.daConfigurare}`}
          onClick={() => setMostraConfig((v) => !v)}
          title="Configura schermata voti e animazione prigioniero"
          aria-label="Configura voti e prigioniero"
          aria-expanded={mostraConfig}
        >
          <IconaVoto dimensione={30} />
          {numeroBadge !== undefined && <span className={styles.numeroBadge}>{numeroBadge}</span>}
        </button>

        {mostraConfig && (
          <>
            <div className={stylesConfig.backdrop} onClick={() => setMostraConfig(false)} />
            <div className={stylesConfig.pannello}>
              <h3 className={stylesConfig.titolo}>Voti e prigioniero</h3>

              <div className={stylesConfig.sezione}>
                <span className={stylesConfig.sezTitolo}>Schermata voti</span>
                <SlotAsset
                  label="Sfondo voti"
                  valore={sfondoVotiPath?.split(/[/\\]/).pop() ?? null}
                  onClick={() => void caricaSfondoVoti()}
                  tipo="immagine"
                />
              </div>

              <div className={stylesConfig.sezione}>
                <span className={stylesConfig.sezTitolo}>Animazione incarcerazione</span>
                <SlotAsset
                  label="Sfondo animazione"
                  valore={sfondoPrigionieroPath?.split(/[/\\]/).pop() ?? null}
                  onClick={() => void caricaSfondoPrigioniero()}
                  tipo="immagine"
                />
                <SlotAsset
                  label="Suono sbarre"
                  valore={suonoPrigionieroPath?.split(/[/\\]/).pop() ?? null}
                  onClick={() => void caricaSuonoSbarre()}
                  tipo="audio"
                />
                <SlotAsset
                  label="Sting drammatico"
                  valore={suonoPrigionieroStingPath?.split(/[/\\]/).pop() ?? null}
                  onClick={() => void caricaSuonoSting()}
                  tipo="audio"
                />
                <SlotAsset
                  label="Sirena"
                  valore={suonoPrigionieroSirenaPath?.split(/[/\\]/).pop() ?? null}
                  onClick={() => void caricaSuonoSirena()}
                  tipo="audio"
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Modalità play: il pulsante mostra/nasconde la schermata voti sulla proiezione
  return (
    <button
      type="button"
      className={`${styles.btnIcona} ${aperta ? styles.attivo : ""}`}
      onClick={() => (aperta ? chiudi() : apri())}
      disabled={current.personaggi.every((p) => p.npc)}
      title={
        current.personaggi.every((p) => p.npc)
          ? "Serve almeno 1 personaggio non-NPC"
          : aperta
            ? "Nascondi la schermata dei voti"
            : "Mostra la schermata dei voti"
      }
      aria-label="Schermata voti"
    >
      <IconaVoto dimensione={30} />
      {numeroBadge !== undefined && <span className={styles.numeroBadge}>{numeroBadge}</span>}
    </button>
  );
}

interface SlotAssetProps {
  label: string;
  valore: string | null;
  onClick: () => void;
  tipo: "immagine" | "audio";
}

function SlotAsset({ label, valore, onClick, tipo }: SlotAssetProps) {
  return (
    <button type="button" className={stylesConfig.slot} onClick={onClick}>
      <span className={stylesConfig.slotTipo}>{tipo === "immagine" ? "🖼" : "🔊"}</span>
      <span className={stylesConfig.slotLabel}>{label}</span>
      <span
        className={`${stylesConfig.slotValore} ${valore ? stylesConfig.configurato : stylesConfig.mancante}`}
      >
        {valore ?? "— non impostato —"}
      </span>
    </button>
  );
}
