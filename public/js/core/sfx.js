// Âm thanh hiệu ứng (tiếng "ting", "bùm", nhịp tim…) tạo trực tiếp bằng Web Audio:
// không cần file âm thanh, không tốn dung lượng tải. Chỉ kêu sau lần chạm đầu tiên (quy định của trình duyệt).
// Tắt/bật chung với nút 🔊 của nhạc nền (setSfxMuted).

let ac = null;
let master = null;
let noiseBuf = null;
let muted = false;
const VOLUME = 0.55;

function audio() {
  if (muted) return null;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ac = new AC();
    } catch {
      return null;
    }
    master = ac.createGain();
    master.gain.value = VOLUME;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

// Mở khoá âm thanh ở lần chạm đầu (iPhone, trình duyệt trong Zalo/Messenger cần việc này).
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (!audio()) return;
    // Phát một khoảng lặng rất ngắn để iOS cho phép kêu về sau.
    const s = ac.createBufferSource();
    s.buffer = ac.createBuffer(1, 1, 22050);
    s.connect(master);
    s.start();
    if (ac.state === 'running') removeEventListener('pointerdown', unlock, true);
  };
  addEventListener('pointerdown', unlock, true);
}

export function setSfxMuted(value) {
  muted = value;
  if (master) master.gain.value = value ? 0 : VOLUME;
}

/** Một nốt: tần số (có thể trượt), dạng sóng, độ dài, âm lượng. */
function tone(c, { freq, to, type = 'sine', at = 0, dur = 0.3, vol = 0.3, attack = 0.005 }) {
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

/** Tiếng xì/gió: nhiễu trắng qua bộ lọc (có thể quét tần số). */
function hiss(c, { at = 0, dur = 0.5, vol = 0.3, type = 'bandpass', freq = 1200, to, q = 1, attack = 0.02 }) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + at;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t0, Math.random() * 0.5);
  s.stop(t0 + dur + 0.05);
}

const NOTES = [1046.5, 1318.5, 1568, 2093]; // Đô – Mi – Son – Đô (cao)

/** Các âm thanh dùng trong thiệp. Thiếu Web Audio hoặc đang tắt tiếng thì không làm gì. */
export const sfx = {
  /** "Bụp" nhẹ: chạm nút, ảnh bay vào. */
  pop(vol = 0.25) {
    const c = audio();
    if (c) tone(c, { freq: 380, to: 900, dur: 0.09, vol });
  },
  /** "Tách": đổi chỗ mảnh ghép. */
  click() {
    const c = audio();
    if (c) tone(c, { freq: 1800, to: 900, type: 'triangle', dur: 0.05, vol: 0.18 });
  },
  /** "Ting ting ting": mở ra, hoàn thành. */
  chime(vol = 0.22) {
    const c = audio();
    if (!c) return;
    NOTES.forEach((f, i) => tone(c, { freq: f, type: 'triangle', at: i * 0.07, dur: 0.9, vol }));
  },
  /** Lấp lánh: vài tiếng "ting" cao ngẫu nhiên. */
  sparkle(n = 6) {
    const c = audio();
    if (!c) return;
    for (let i = 0; i < n; i++) tone(c, { freq: 1800 + Math.random() * 2400, at: i * 0.06 + Math.random() * 0.04, dur: 0.35, vol: 0.08 });
  },
  /** "Vút": gió lướt qua — khi vào màn hiệu ứng. */
  whoosh() {
    const c = audio();
    if (c) hiss(c, { dur: 0.9, vol: 0.22, freq: 300, to: 3200, q: 0.8, attack: 0.35 });
  },
  /** Mở màn hiệu ứng: vút + ting lấp lánh. */
  magic() {
    sfx.whoosh();
    const c = audio();
    if (!c) return;
    NOTES.forEach((f, i) => tone(c, { freq: f, type: 'triangle', at: 0.35 + i * 0.09, dur: 1.2, vol: 0.14 }));
  },
  /** "Bùm" pháo hoa. */
  boom() {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 120, to: 40, dur: 0.5, vol: 0.35 });
    hiss(c, { dur: 0.7, vol: 0.25, type: 'lowpass', freq: 2200, to: 300 });
    for (let i = 0; i < 5; i++) hiss(c, { at: 0.25 + Math.random() * 0.5, dur: 0.06, vol: 0.06, type: 'highpass', freq: 3000 });
  },
  /** "Pằng!" pháo giấy. */
  party() {
    const c = audio();
    if (!c) return;
    hiss(c, { dur: 0.25, vol: 0.3, type: 'highpass', freq: 1500, attack: 0.005 });
    tone(c, { freq: 600, to: 1400, dur: 0.12, vol: 0.18, type: 'triangle' });
    sfx.sparkle(5);
  },
  /** "Thình thịch": nhịp tim. */
  heartbeat(vol = 0.5) {
    const c = audio();
    if (!c) return;
    tone(c, { freq: 70, to: 40, dur: 0.18, vol });
    tone(c, { freq: 66, to: 38, at: 0.22, dur: 0.16, vol: vol * 0.7 });
  },
  /** Lắc hộp quà: lục cục, càng lắc càng cao. */
  rattle(power = 1) {
    const c = audio();
    if (!c) return;
    for (let i = 0; i < 4; i++) hiss(c, { at: i * 0.05, dur: 0.05, vol: 0.18, freq: 700 + power * 300, q: 4, attack: 0.003 });
  },
  /** "Bóing": nút bỏ chạy. */
  boing() {
    const c = audio();
    if (c) tone(c, { freq: 220, to: 660, type: 'triangle', dur: 0.18, vol: 0.18 });
  },
  /** Tiếng buồn "ồ…": bị từ chối. */
  sad() {
    const c = audio();
    if (c) tone(c, { freq: 440, to: 220, type: 'triangle', dur: 0.45, vol: 0.14 });
  },
  /** Âm cao dần khi giữ tay sạc tim. Trả về { set(0..1), stop() }. */
  rise() {
    const c = audio();
    if (!c) return { set() {}, stop() {} };
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = 220;
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.1);
    o.connect(g).connect(master);
    o.start();
    return {
      set(p) {
        o.frequency.setTargetAtTime(220 + p * 660, c.currentTime, 0.05);
      },
      stop() {
        g.gain.setTargetAtTime(0.0001, c.currentTime, 0.05);
        o.stop(c.currentTime + 0.3);
      },
    };
  },
};
