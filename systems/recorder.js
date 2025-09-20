let recorder = null, chunks = [], stream = null;
let detachAudio = null;

export function startRecording(canvas, fps = 30) {
  try {
    stopRecordingSync();
    const canvasStream = canvas?.captureStream?.(fps);
    if (!canvasStream) { console.warn('captureStream not supported'); return; }
    // attach game audio
    import('./audio.js').then(({ attachRecordingDestination }) => {
      const { stream: audioStream, detach } = attachRecordingDestination();
      detachAudio = detach || null;
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioStream ? audioStream.getAudioTracks() : [])
      ]);
      chunks = [];
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        ''
      ];
      const mimeType = mimeTypes.find(t => t && MediaRecorder.isTypeSupported?.(t)) || undefined;
      recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onerror = (e) => console.warn('Recorder error:', e);
      recorder.start(250);
      stream = combined;
    });
  } catch (e) { console.warn('Recorder start failed:', e); }
}

function stopRecordingSync() {
  try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch {}
  try { stream?.getTracks?.().forEach(t => t.stop()); } catch {}
  try { detachAudio?.(); } catch {}
  recorder = null; stream = null; detachAudio = null;
}

export function stopRecording() {
  return new Promise((resolve) => {
    const rec = recorder;
    if (!rec) return resolve(null);
    const finish = () => {
      const blob = chunks.length ? new Blob(chunks, { type: 'video/webm' }) : null;
      chunks = [];
      try { stream?.getTracks?.().forEach(t => t.stop()); } catch {}
      try { detachAudio?.(); } catch {}
      recorder = null; stream = null; detachAudio = null;
      resolve(blob);
    };
    const onStop = () => { rec.removeEventListener('stop', onStop); finish(); };
    rec.addEventListener('stop', onStop);
    let safety = setTimeout(()=>{ try{ rec.removeEventListener('stop', onStop);}catch{} finish(); }, 2000);
    try { rec.stop(); } catch { clearTimeout(safety); finish(); }
  });
}