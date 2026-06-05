import SezionePersonaggi from "./SezionePersonaggi";
import SezioneOggetti from "./SezioneOggetti";
import styles from "./PannelloPersonaggi.module.css";

interface Props {
  onNuovoPersonaggio: () => void;
  onNuovoOggetto: () => void;
}

export default function PannelloPersonaggi({ onNuovoPersonaggio, onNuovoOggetto }: Props) {
  return (
    <aside className={styles.root}>
      <SezionePersonaggi onNuovoPersonaggio={onNuovoPersonaggio} />
      <div className={styles.divisore} />
      <SezioneOggetti onNuovoOggetto={onNuovoOggetto} />
    </aside>
  );
}
