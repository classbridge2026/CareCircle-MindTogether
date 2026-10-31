let shared: AudioContext | null = null;
let primed = false;

function audioContext(): AudioContext | null {
  const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!shared || shared.state === "closed") {
    try {
      shared = new Ctx();
    } catch {
      return null;
    }
  }
  return shared;
}

/** Unlock sound on the first tap so a later incoming call can ring immediately. */
export function primeRingtone() {
  if (primed || typeof window === "undefined") return;
  primed = true;
  const unlock = () => {
    const ctx = audioContext();
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  unlock();
}

function pulse() {
  if (typeof navigator.vibrate === "function") navigator.vibrate([450, 180, 450, 1100]);
}

export function startRingtone(): () => void {
  const ctx = audioContext();
  if (!ctx) return () => undefined;
  const audio = ctx;
  let stopped = false;
  let playing = false;
  let timer = 0;

  function tone(when: number, duration: number) {
    const gain = audio.createGain();
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.2, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    for (const frequency of [440, 480]) {
      const osc = audio.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      osc.connect(gain);
      osc.start(when);
      osc.stop(when + duration);
    }
  }

  function pattern() {
    if (stopped || audio.state !== "running") {
      playing = false;
      return;
    }
    const now = audio.currentTime;
    try {
      tone(now, 0.42);
      tone(now + 0.55, 0.42);
      pulse();
    } catch {
      stopped = true;
      return;
    }
    timer = window.setTimeout(pattern, 2000);
  }

  function resume() {
    if (stopped || playing) return;
    void audio.resume().then(() => {
      if (stopped || playing || audio.state !== "running") return;
      playing = true;
      pattern();
    }).catch(() => undefined);
  }

  resume();
  window.addEventListener("pointerdown", resume);
  return () => {
    stopped = true;
    playing = false;
    window.clearTimeout(timer);
    window.removeEventListener("pointerdown", resume);
    if (typeof navigator.vibrate === "function") navigator.vibrate(0);
  };
}
