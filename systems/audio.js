let audioCtx;
export const sounds = {};
let waterfall = { buffer: null, src: null, gain: null, playing: false };
let masterGain = null;

export async function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain(); masterGain.gain.value = 1;
    masterGain.connect(audioCtx.destination);
    sounds.catch = await loadSound('/catch.mp3');
    sounds.splash = await loadSound('/splash.mp3');
    sounds.whoosh = await loadSound('/whoosh.mp3');
    // prep noise buffer for waterfall
    if (!waterfall.buffer) waterfall.buffer = createNoiseBuffer(audioCtx, 2.0);
}

export function wireAudioUnlock(initFn) {
    const unlock = () => {
        initFn();
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    window.addEventListener('pointerdown', unlock);
}

async function loadSound(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioCtx.decodeAudioData(arrayBuffer);
}

function createNoiseBuffer(ctx, durationSec = 2.0) {
    const ch = 1, len = Math.floor(ctx.sampleRate * durationSec);
    const buf = ctx.createBuffer(ch, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
    return buf;
}

export function playSFX(buffer) {
    if (!audioCtx || !buffer) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGain);
    source.start(0);
}

export function startWaterfall(volume = 0.12) {
    if (!audioCtx) return;
    if (waterfall.playing) return;
    const src = audioCtx.createBufferSource();
    src.buffer = waterfall.buffer || createNoiseBuffer(audioCtx, 2.0);
    src.loop = true;
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.6;
    const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120; hp.Q.value = 0.7;
    const gain = audioCtx.createGain(); gain.gain.value = 0.0001;
    src.connect(lp); lp.connect(hp); hp.connect(gain); gain.connect(masterGain);
    src.start();
    const now = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 1.2);
    waterfall = { buffer: waterfall.buffer, src, gain, playing: true };
}

export function stopWaterfall(fadeOutSec = 0.8) {
    if (!audioCtx || !waterfall.playing || !waterfall.src) return;
    const now = audioCtx.currentTime;
    waterfall.gain.gain.cancelScheduledValues(now);
    waterfall.gain.gain.exponentialRampToValueAtTime(0.001, now + fadeOutSec);
    const srcRef = waterfall.src;
    setTimeout(()=>{ try { srcRef.stop(); } catch {} }, fadeOutSec * 1000 + 20);
    waterfall.playing = false;
}

export function setWaterfallVolume(vol = 0.12) {
    if (!audioCtx || !waterfall.gain) return;
    const now = audioCtx.currentTime;
    waterfall.gain.gain.cancelScheduledValues(now);
    waterfall.gain.gain.linearRampToValueAtTime(vol, now + 0.3);
}

export function attachRecordingDestination() {
    if (!audioCtx || !masterGain) return { stream: null, detach: ()=>{} };
    const mediaDest = audioCtx.createMediaStreamDestination();
    try { masterGain.connect(mediaDest); } catch {}
    return { stream: mediaDest.stream, detach: () => { try { masterGain.disconnect(mediaDest); } catch {} } };
}