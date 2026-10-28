import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "./voice-frame.css";

export function useVoice(participant: { audioLevel: number; isSpeaking: boolean } | null | undefined) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!participant) {
      setLevel(0);
      return;
    }
    let frame = 0;
    let last = -1;
    const tick = () => {
      const next = participant.isSpeaking ? Math.max(0.22, Math.min(1, participant.audioLevel * 6)) : 0;
      if (Math.abs(next - last) > 0.05) {
        last = next;
        setLevel(next);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [participant]);
  return level;
}

export function VoiceFrame({ level, label, face }: { level: number; label: string; face?: ReactNode }) {
  const talk = Math.max(0, Math.min(1, level));
  const talking = talk > 0.08;
  return (
    <div
      className={talking ? "dr-voice is-talking" : "dr-voice"}
      style={{ "--talk": String(talk) } as CSSProperties}
      role="img"
      aria-label={talking ? `${label} is talking` : label}
    >
      <i />
      <i />
      <i />
      <div className="dr-voice-face">{face ?? <span>{label.slice(0, 1).toUpperCase()}</span>}</div>
    </div>
  );
}
