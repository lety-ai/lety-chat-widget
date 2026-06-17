// Single fixed notification sound synthesized with the Web Audio API so the
// bundle ships no audio asset. Used on new agent messages when the widget has
// the notification sound enabled.

type AudioCtor = typeof AudioContext;

let audioContext: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
};

export const playNotificationSound = (): void => {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = 660;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    oscillator.start(now);
    oscillator.stop(now + 0.26);
  } catch {
    /* autoplay restrictions / unsupported — silently ignore */
  }
};
