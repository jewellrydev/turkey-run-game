// Turkey Run — tiny WebAudio bleeps, no audio files.
// One shared AudioContext, created lazily on the first user gesture.
const TurkeyAudio = (() => {
  let ctx = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freqFrom, freqTo, seconds, type, volume) {
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const t = ac.currentTime;
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 1), t + seconds);
    gain.gain.setValueAtTime(volume || 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + seconds);
  }

  return {
    unlock: ensure,
    start() { tone(660, 990, 0.18, "triangle", 0.08); },
    jump() { tone(320, 720, 0.16, "square", 0.07); },
    duck() { tone(300, 140, 0.12, "square", 0.05); },
    corn() { tone(880, 1320, 0.14, "triangle", 0.09); },
    hit() { tone(220, 55, 0.3, "sawtooth", 0.11); },
    win() { tone(523, 1046, 0.45, "triangle", 0.1); },
    lose() { tone(392, 98, 0.6, "sawtooth", 0.1); },
  };
})();
