export function startRingtone(): () => void {
  const Ctx = window.AudioContext;
  if (!Ctx) return () => undefined;
  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return () => undefined;
  }
  let stopped = false;
  let timer = 0;

  function tone(when: number) {
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.06, when + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.38);
    for (const frequency of [440, 480]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      osc.connect(gain);
      osc.start(when);
      osc.stop(when + 0.4);
    }
  }

  function pattern() {
    if (stopped || ctx.state === "closed") return;
    const now = ctx.currentTime;
    try {
      tone(now);
      tone(now + 0.5);
    } catch {
      stopped = true;
      return;
    }
    timer = window.setTimeout(pattern, 2400);
  }

  function resume() {
    if (stopped) return;
    void ctx.resume().then(() => {
      if (!stopped && ctx.state === "running") pattern();
    }).catch(() => undefined);
  }

  resume();
  window.addEventListener("pointerdown", resume);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
    window.removeEventListener("pointerdown", resume);
    void ctx.close().catch(() => undefined);
  };
}
