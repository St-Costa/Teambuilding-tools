import styles from "./EmojiPicker.module.css";

// Lista curata di emoji utili per teambuilding / soundboard.
// Tutte unicode standard, renderizzate dal font del sistema.
const EMOJI: string[] = [
  // Suoni / azioni
  "🔔",
  "🎵",
  "🎶",
  "📢",
  "🔊",
  "🎺",
  "🎷",
  "🥁",
  "🎸",
  "🎻",
  "🎤",
  "📯",
  "🛎",
  "⏰",
  "💥",
  "🚨",
  // Reazioni
  "👏",
  "🎉",
  "🎊",
  "🏆",
  "🥇",
  "🥈",
  "🥉",
  "👑",
  "😂",
  "🤣",
  "😱",
  "🙀",
  "😎",
  "🤩",
  "😡",
  "🤔",
  // Animali
  "🐱",
  "🐶",
  "🐺",
  "🦁",
  "🐯",
  "🐻",
  "🐼",
  "🦊",
  "🐸",
  "🐵",
  "🦉",
  "🐔",
  "🦆",
  "🦅",
  "🐍",
  "🐢",
  // Oggetti / scena
  "💀",
  "👻",
  "🔥",
  "💣",
  "💎",
  "⚔",
  "🛡",
  "🏹",
  "🗝",
  "🔑",
  "🚪",
  "🚂",
  "🚗",
  "🛸",
  "🗺",
  "🧭",
];

interface Props {
  selezionata: string;
  onSeleziona: (emoji: string) => void;
}

export default function EmojiPicker({ selezionata, onSeleziona }: Props) {
  return (
    <div className={styles.griglia}>
      {EMOJI.map((e) => (
        <button
          key={e}
          type="button"
          className={`${styles.cella} ${e === selezionata ? styles.cellaScelta : ""}`}
          onClick={() => onSeleziona(e)}
          title={e}
          aria-label={`Emoji ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
