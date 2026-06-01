// Web-Audio "ting" — no audio asset, no bundle bloat, honors browser autoplay rules.

let audioCtx: AudioContext | null = null;
let userInteracted = false;

if (typeof window !== 'undefined') {
  const markInteracted = () => {
    userInteracted = true;
    window.removeEventListener('pointerdown', markInteracted);
    window.removeEventListener('keydown', markInteracted);
    window.removeEventListener('touchstart', markInteracted);
  };
  window.addEventListener('pointerdown', markInteracted, { once: true });
  window.addEventListener('keydown', markInteracted, { once: true });
  window.addEventListener('touchstart', markInteracted, { once: true });
}

const STORAGE_KEY = 'notification-sound';

export function isNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(STORAGE_KEY) !== 'off';
}

export function setNotificationSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
}

export function playNotificationTing() {
  if (typeof window === 'undefined') return;
  if (!userInteracted) return;
  if (!isNotificationSoundEnabled()) return;

  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const ctx = audioCtx;
    const now = ctx.currentTime;

    // Two-tone bell: E6 then A6, short bell envelope.
    [{ freq: 1318.51, when: 0 }, { freq: 1760, when: 0.11 }].forEach(({ freq, when }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now + when);
      gain.gain.exponentialRampToValueAtTime(0.22, now + when + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + when + 0.42);
      osc.start(now + when);
      osc.stop(now + when + 0.5);
    });
  } catch {
    // Audio unavailable; silently no-op.
  }
}
