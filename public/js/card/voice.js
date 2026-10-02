// Lời nhắn giọng nói:
//   voiceRecorder() — ở trình tạo: bấm ghi, nói (tối đa 60 giây), nghe lại, ghi lại hoặc xóa.
//   voicePlayer()   — trong thiệp: nút phát to + sóng âm nhảy theo giọng; nhạc nền tạm nhỏ lại khi đang nghe.
import { el, toast } from '../core/dom.js';
import { VOICE, pickRecorderType } from '../shared/extras.js';

const BARS = 28;

/** Vẽ sóng âm (các thanh dọc) từ một AnalyserNode lên canvas; trả về hàm dừng. */
function drawBars(canvas, analyser, color) {
  const g = canvas.getContext('2d');
  const buf = new Uint8Array(analyser.frequencyBinCount);
  let raf = 0;
  const frame = () => {
    const w = (canvas.width = canvas.clientWidth * 2);
    const h = (canvas.height = canvas.clientHeight * 2);
    analyser.getByteFrequencyData(buf);
    g.clearRect(0, 0, w, h);
    g.fillStyle = color;
    const step = Math.floor(buf.length / 2 / BARS);
    const bw = w / BARS;
    for (let i = 0; i < BARS; i++) {
      const v = buf[i * step] / 255;
      const bh = Math.max(h * 0.08, v * h * 0.95);
      g.beginPath();
      g.roundRect(i * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh, bw * 0.3);
      g.fill();
    }
    raf = requestAnimationFrame(frame);
  };
  frame();
  return () => cancelAnimationFrame(raf);
}

/** Sóng âm "giả" nhấp nhô nhẹ khi chưa phát (để người nhận hiểu đây là đoạn ghi âm). */
function idleBars(canvas, color) {
  const g = canvas.getContext('2d');
  const w = (canvas.width = (canvas.clientWidth || 260) * 2);
  const h = (canvas.height = (canvas.clientHeight || 48) * 2);
  g.fillStyle = color;
  const bw = w / BARS;
  for (let i = 0; i < BARS; i++) {
    const bh = h * (0.18 + 0.5 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)));
    g.beginPath();
    g.roundRect(i * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh, bw * 0.3);
    g.fill();
  }
}

let audioCtx = null;
const ctx = () => (audioCtx ??= new (window.AudioContext || window.webkitAudioContext)());

/**
 * Ô ghi âm ở trình tạo. current: { type, buf } | null. onChange(value | null) khi ghi xong hoặc xóa.
 */
export function voiceRecorder(current, onChange) {
  const box = el('div', { class: 'voice-box' });
  const type = pickRecorderType('audio');
  let url = null;

  const render = (value) => {
    if (url) URL.revokeObjectURL(url);
    url = null;
    if (!type || !navigator.mediaDevices?.getUserMedia) {
      box.replaceChildren(el('p', { class: 'muted small', text: '🎙️ Trình duyệt này chưa ghi âm được. Bạn mở bằng Chrome hoặc Safari để thêm lời nhắn giọng nói nhé.' }));
      return;
    }
    if (!value) {
      box.replaceChildren(
        el('button', { class: 'btn btn-soft voice-rec-btn', text: '🎙️ Bấm để ghi âm', attrs: { type: 'button' }, on: { click: record } }),
        el('p', { class: 'muted small', text: `Nói vài câu bằng chính giọng của bạn (tối đa ${VOICE.maxSeconds} giây). Người nhận nghe được ở cuối thiệp.` }),
      );
      return;
    }
    url = URL.createObjectURL(new Blob([value.buf], { type: value.type }));
    const audio = el('audio', { attrs: { controls: '', src: url, preload: 'metadata' } });
    box.replaceChildren(
      el('p', { class: 'voice-done', text: '✅ Đã có lời nhắn giọng nói' }),
      audio,
      el('div', { class: 'share-actions' }, [
        el('button', { class: 'btn btn-soft btn-sm', text: '🔁 Ghi lại', attrs: { type: 'button' }, on: { click: record } }),
        el('button', {
          class: 'btn btn-ghost btn-sm',
          text: '🗑️ Xóa',
          attrs: { type: 'button' },
          on: { click: () => (onChange(null), render(null)) },
        }),
      ]),
    );
  };

  async function record() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      toast('Chưa được phép dùng micro. Bạn cho phép micro trong cài đặt trình duyệt rồi thử lại nhé.', 5000);
      return;
    }
    const rec = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: VOICE.bitsPerSecond });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const canvas = el('canvas', { class: 'voice-wave', attrs: { 'aria-hidden': 'true' } });
    const time = el('span', { class: 'voice-time', text: '0:00' });
    const stop = el('button', { class: 'btn btn-primary voice-rec-btn recording', text: '⏹ Dừng', attrs: { type: 'button' }, on: { click: () => rec.state === 'recording' && rec.stop() } });
    box.replaceChildren(el('div', { class: 'voice-live' }, [el('span', { class: 'voice-dot' }), time, canvas]), stop);
    const source = ctx().createMediaStreamSource(stream);
    const analyser = ctx().createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const stopDraw = drawBars(canvas, analyser, '#ff4d6d');
    const started = performance.now();
    const timer = setInterval(() => {
      const s = Math.floor((performance.now() - started) / 1000);
      time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} / ${VOICE.maxSeconds}s`;
      if (s >= VOICE.maxSeconds && rec.state === 'recording') rec.stop();
    }, 250);
    rec.onstop = async () => {
      clearInterval(timer);
      stopDraw();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      if (blob.size > VOICE.maxBytes) {
        toast('Đoạn ghi âm nặng quá, bạn nói ngắn hơn chút nhé.', 4000);
        return render(current);
      }
      if (blob.size < 1000) {
        toast('Chưa nghe thấy gì, bạn thử ghi lại nhé.', 3500);
        return render(current);
      }
      current = { type: blob.type, buf: await blob.arrayBuffer() };
      onChange(current);
      render(current);
      toast('Đã lưu lời nhắn giọng nói 🎙️');
    };
    rec.start(500);
  }

  render(current);
  return box;
}

/**
 * Trình phát trong thiệp: "🎙️ {sender} gửi bạn một lời nhắn bằng giọng nói".
 * music: trình phát nhạc nền (để nhỏ nhạc lại khi đang nghe).
 */
export function voicePlayer(src, { sender, music }) {
  const audio = new Audio();
  audio.preload = 'none';
  audio.src = src;
  const canvas = el('canvas', { class: 'voice-wave', attrs: { 'aria-hidden': 'true' } });
  const btn = el('button', { class: 'voice-play', text: '▶', attrs: { type: 'button', 'aria-label': 'Nghe lời nhắn giọng nói' } });
  const panel = el('section', { class: 'voice-panel' }, [
    el('p', { class: 'voice-title', text: `🎙️ ${sender} gửi bạn lời nhắn bằng giọng nói` }),
    el('div', { class: 'voice-row' }, [btn, canvas]),
  ]);
  requestAnimationFrame(() => idleBars(canvas, 'rgba(255, 77, 109, 0.35)'));
  let stopDraw = null;
  let wired = false;
  btn.addEventListener('click', async () => {
    if (!audio.paused) return audio.pause();
    try {
      if (!wired) {
        // Nối vào bộ phân tích để sóng nhảy theo giọng (chỉ nối một lần).
        const source = ctx().createMediaElementSource(audio);
        const analyser = ctx().createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser).connect(ctx().destination);
        audio.analyser = analyser;
        wired = true;
      }
      await ctx().resume();
      music?.duck?.(true);
      await audio.play();
    } catch {
      toast('Chưa phát được lời nhắn, bạn thử lại nhé.');
    }
  });
  audio.addEventListener('play', () => {
    btn.textContent = '⏸';
    panel.classList.add('playing');
    if (audio.analyser) stopDraw = drawBars(canvas, audio.analyser, '#ff4d6d');
  });
  const ended = () => {
    btn.textContent = '▶';
    panel.classList.remove('playing');
    stopDraw?.();
    idleBars(canvas, 'rgba(255, 77, 109, 0.35)');
    music?.duck?.(false);
  };
  audio.addEventListener('pause', ended);
  audio.addEventListener('ended', ended);
  return panel;
}
