// Synthesized game cues. We generate every sound with the Web Audio API rather
// than shipping audio files — it keeps the bundle lean and there's nothing to
// host. All cues no-op while muted, and the AudioContext is created lazily on
// the first user gesture to satisfy browser autoplay policies.

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
    muted = value;
}

function getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        try {
            ctx = new Ctor();
        } catch {
            return null;
        }
    }
    return ctx;
}

// Call from a user gesture (e.g. pressing play) so later cues can sound without
// being blocked. Safe to call repeatedly.
export function unlock() {
    const c = getContext();
    if (c && c.state === 'suspended') void c.resume();
}

// One enveloped tone. Gain ramps avoid the click you'd get from a hard start/stop.
function tone(freq: number, start: number, duration: number, peak: number, type: OscillatorType = 'sine') {
    const c = getContext();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
}

// Barely-there UI whisper for hovering primary controls — texture, not
// feedback, so it sits far quieter than playTick. Only sounds once the
// context is running (a prior user gesture has unlocked it); before that it
// no-ops rather than queueing, per browser autoplay policy.
export function playHover() {
    if (muted) return;
    const c = getContext();
    if (!c || c.state !== 'running') return;
    tone(1174.66, c.currentTime, 0.05, 0.035, 'sine'); // D6, near-subliminal
}

export function playTick() {
    if (muted) return;
    const c = getContext();
    if (!c) return;
    tone(880, c.currentTime, 0.09, 0.18, 'square');
}

export function playCorrect() {
    if (muted) return;
    const c = getContext();
    if (!c) return;
    const t = c.currentTime;
    tone(587.33, t, 0.16, 0.2, 'triangle'); // D5
    tone(880, t + 0.1, 0.26, 0.22, 'triangle'); // A5
}

export function playWrong() {
    if (muted) return;
    const c = getContext();
    if (!c) return;
    const t = c.currentTime;
    tone(196, t, 0.26, 0.22, 'sawtooth'); // G3, dry buzz
}

export function playComplete() {
    if (muted) return;
    const c = getContext();
    if (!c) return;
    const t = c.currentTime;
    // Small ascending flourish.
    tone(523.25, t, 0.18, 0.18, 'triangle'); // C5
    tone(659.25, t + 0.12, 0.18, 0.18, 'triangle'); // E5
    tone(783.99, t + 0.24, 0.34, 0.2, 'triangle'); // G5
}

// navigator.vibrate is Android-Chrome only; guard so it's a safe no-op elsewhere.
export function vibrate(pattern: number | number[]) {
    if (muted) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    try {
        navigator.vibrate(pattern);
    } catch {
        /* unsupported */
    }
}
