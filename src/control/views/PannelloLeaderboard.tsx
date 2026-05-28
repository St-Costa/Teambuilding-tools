import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { useLeaderboardStore } from "../../state/leaderboardStore";
import { risolviAsset } from "../../lib/storage";
import Cerchietto from "../../components/Cerchietto";
import ClassificaPodio from "../../components/ClassificaPodio";
import type { RigaLeaderboardSnap } from "../../lib/events";
import styles from "./PannelloLeaderboard.module.css";

interface Props {
  onChiudi: () => void;
}

export default function PannelloLeaderboard({ onChiudi }: Props) {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const setObiettivo = useAmbientazioneStore((s) => s.setObiettivo);

  const righe = useLeaderboardStore((s) => s.righe);
  const tick = useLeaderboardStore((s) => s.tick);
  const toggleTick = useLeaderboardStore((s) => s.toggleTick);
  const chiudi = useLeaderboardStore((s) => s.chiudi);

  if (!current || !folderPath) return null;

  const righeConTotale: RigaLeaderboardSnap[] = righe.map((r) => {
    const t = tick[r.personaggioId] ?? [false, false, false];
    return {
      personaggioId: r.personaggioId,
      nome: r.nome,
      colore: r.colore,
      imgPath: r.imgPath,
      crop: r.crop,
      tick: t,
      totale: (t[0] ? 1 : 0) + (t[1] ? 1 : 0) - (t[2] ? 1 : 0),
    };
  });

  function handleChiudi() {
    const haTickAttivi = Object.values(tick).some((t) => t.some(Boolean));
    if (haTickAttivi) {
      if (!confirm("Chiudere la leaderboard? I tick attuali verranno persi.")) return;
    }
    chiudi();
    onChiudi();
  }

  function labelObiettivo(idx: 0 | 1 | 2): string {
    const t = (current?.obiettivi?.[idx] ?? "").trim();
    return t || `Obiettivo ${idx + 1}`;
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modale}>
        <header className={styles.header}>
          <h2>Leaderboard</h2>
          <button
            type="button"
            className={styles.btnChiudi}
            onClick={handleChiudi}
          >
            Chiudi
          </button>
        </header>

        <section className={styles.sezioneObiettivi}>
          <p className={styles.hint}>
            Imposta i nomi dei 3 obiettivi (salvati nell'ambientazione).
          </p>
          <div className={styles.gruppoObiettivi}>
            {([0, 1, 2] as const).map((idx) => (
              <label key={idx} className={styles.label}>
                <span className={styles.labelTesto}>
                  {idx === 2 ? "Malus" : `Obiettivo ${idx + 1}`}
                </span>
                <input
                  type="text"
                  value={current.obiettivi[idx]}
                  onChange={(e) => setObiettivo(idx, e.target.value)}
                  maxLength={60}
                  placeholder={
                    idx === 2 ? `es. "Penalità"` : `es. "Obiettivo ${idx + 1}"`
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section className={styles.sezioneTabella}>
          {righe.length === 0 ? (
            <p className={styles.vuoto}>Nessun personaggio nell'ambientazione.</p>
          ) : (
            <table className={styles.tabella}>
              <thead>
                <tr>
                  <th className={styles.thPersonaggio}>Personaggio</th>
                  {([0, 1, 2] as const).map((idx) => (
                    <th
                      key={idx}
                      className={`${styles.thObiettivo} ${idx === 2 ? styles.thObiettivoMalus : ""}`}
                      title={idx === 2 ? "Malus: vale −1 sul totale" : undefined}
                    >
                      {labelObiettivo(idx)}
                    </th>
                  ))}
                  <th className={styles.thTotale}>Tot.</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => {
                  const t = tick[r.personaggioId] ?? [false, false, false];
                  // 3° obiettivo è malus: -1 quando attivo.
                  const totale = (t[0] ? 1 : 0) + (t[1] ? 1 : 0) - (t[2] ? 1 : 0);
                  return (
                    <tr key={r.personaggioId}>
                      <td className={styles.tdPersonaggio}>
                        <Cerchietto
                          src={risolviAsset(folderPath, r.imgPath)}
                          colore={r.colore}
                          crop={r.crop}
                          dimensione={44}
                          alt={r.nome}
                        />
                        <span className={styles.nomePersonaggio}>{r.nome}</span>
                      </td>
                      {([0, 1, 2] as const).map((idx) => (
                        <td
                          key={idx}
                          className={`${styles.tdTick} ${t[idx] ? (idx === 2 ? styles.tdTickMalusOn : styles.tdTickOn) : ""}`}
                          onClick={() => toggleTick(r.personaggioId, idx)}
                          title={t[idx] ? "Click per rimuovere" : "Click per aggiungere"}
                        >
                          {t[idx] ? (idx === 2 ? "✗" : "✓") : ""}
                        </td>
                      ))}
                      <td className={styles.tdTotale}>
                        <span
                          className={`${styles.totaleNumero} ${totale < 0 ? styles.totaleNegativo : ""}`}
                        >
                          {totale}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {righeConTotale.length > 0 && (
          <section className={styles.sezionePodio}>
            <ClassificaPodio
              righe={righeConTotale}
              folderPath={folderPath}
              dimensioneCerchietto={64}
            />
          </section>
        )}
      </div>
    </div>
  );
}
