// Quay phản ứng người nhận (chỉ khi người tạo có xin, và người nhận TỰ ĐỒNG Ý):
//   1. Hỏi rõ ràng: ai sẽ xem, quay bao lâu, có được xem lại và từ chối không.
//   2. Đồng ý → camera trước quay 15 giây trong lúc mở thiệp (có ô nhỏ + chấm đỏ để biết đang quay).
//   3. Quay xong → người nhận xem lại, tự bấm "Gửi" hoặc "Xóa". Không bấm gửi thì không có gì rời khỏi máy.
import { uploadReaction } from '../core/api.js';
import { el, toast } from '../core/dom.js';
import { REACTION, pickRecorderType } from '../shared/extras.js';
import { screen, swap } from '../templates/common.js';

/** Hỏi ý người nhận. Trả về hàm "bắt đầu quay" nếu họ đồng ý (và camera mở được), ngược lại null. */
export function askReaction(stage, { sender, onTouch }) {
  const type = pickRecorderType('video');
  if (!type || !navigator.mediaDevices?.getUserMedia) return Promise.resolve(null);
  return new Promise((resolve) => {
    const yes = el('button', { class: 'btn btn-primary btn-lg', text: '📹 Đồng ý quay', attrs: { type: 'button' } });
    const no = el('button', { class: 'btn btn-ghost', text: 'Không, mở thiệp luôn', attrs: { type: 'button' } });
    swap(
      stage,
      screen('rc-ask', [
        el('div', { class: 'tt-envelope', text: '🥹', attrs: { 'aria-hidden': 'true' } }),
        el('p', { class: 'rc-title', text: `${sender} muốn xem phản ứng của bạn khi mở thiệp` }),
        el('ul', { class: 'rc-points' }, [
          el('li', { text: `Quay ${REACTION.seconds} giây bằng camera trước, trong lúc bạn mở thiệp.` }),
          el('li', { text: 'Quay xong bạn được xem lại, rồi tự chọn gửi hay xóa.' }),
          el('li', { text: `Chỉ ${sender} xem được video này.` }),
        ]),
        yes,
        no,
      ]),
    );
    no.addEventListener('click', () => {
      onTouch?.();
      resolve(null);
    });
    yes.addEventListener('click', async () => {
      onTouch?.();
      yes.disabled = true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 360 }, height: { ideal: 480 } },
          audio: true,
        });
        resolve(() => startRecording(stream, type, sender));
      } catch {
        toast('Không mở được camera, mình mở thiệp luôn nhé.', 3500);
        resolve(null);
      }
    });
  });
}

/** Quay 15 giây (ô nhỏ góc màn hình), xong thì hỏi gửi hay xóa. slug/preview gắn sau qua setTarget. */
let target = { slug: null, preview: true };
export const setReactionTarget = (t) => (target = t);

function startRecording(stream, type, sender) {
  const live = el('video', { class: 'rc-live', attrs: { muted: '', playsinline: '', autoplay: '' } });
  live.muted = true;
  live.srcObject = stream;
  const left = el('span', { class: 'rc-left', text: String(REACTION.seconds) });
  const bubble = el('div', { class: 'rc-bubble', attrs: { 'aria-label': 'Đang quay phản ứng' } }, [live, el('span', { class: 'rc-dot' }), left]);
  document.body.append(bubble);

  const rec = new MediaRecorder(stream, {
    mimeType: type,
    videoBitsPerSecond: REACTION.videoBitsPerSecond,
    audioBitsPerSecond: REACTION.audioBitsPerSecond,
  });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const started = Date.now();
  const timer = setInterval(() => {
    const s = Math.max(0, REACTION.seconds - Math.floor((Date.now() - started) / 1000));
    left.textContent = String(s);
    if (s <= 0 && rec.state === 'recording') rec.stop();
  }, 250);
  rec.onstop = () => {
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    bubble.remove();
    const blob = new Blob(chunks, { type: type.split(';')[0] });
    if (blob.size > REACTION.maxBytes || blob.size < 2000) return;
    reviewSheet(blob, sender);
  };
  rec.start(1000);
}

/** Xem lại video vừa quay, người nhận tự quyết gửi hay xóa. */
function reviewSheet(blob, sender) {
  const url = URL.createObjectURL(blob);
  const video = el('video', { class: 'rc-review', attrs: { controls: '', playsinline: '', src: url } });
  const close = () => {
    URL.revokeObjectURL(url);
    sheet.remove();
  };
  const send = el('button', { class: 'btn btn-primary', text: `💌 Gửi cho ${sender}`, attrs: { type: 'button' } });
  const drop = el('button', { class: 'btn btn-ghost', text: '🗑️ Xóa, không gửi', attrs: { type: 'button' }, on: { click: () => (close(), toast('Đã xóa video, không gửi gì cả.')) } });
  send.addEventListener('click', async () => {
    send.disabled = true;
    drop.disabled = true;
    try {
      if (target.preview) toast('Bản xem thử: video chưa được gửi đi 😉', 3000);
      else await uploadReaction(target.slug, blob);
      close();
      if (!target.preview) toast(`Đã gửi video cho ${sender} 💌`);
    } catch (e) {
      toast(e.message, 4000);
      send.disabled = false;
      drop.disabled = false;
    }
  });
  const sheet = el('div', { class: 'rc-sheet', attrs: { role: 'dialog', 'aria-label': 'Xem lại video phản ứng' } }, [
    el('div', { class: 'rc-sheet-box' }, [
      el('p', { class: 'rc-title', text: '📹 Phản ứng của bạn nè' }),
      video,
      el('p', { class: 'muted small', text: `Gửi thì chỉ ${sender} xem được. Không muốn thì cứ xóa.` }),
      el('div', { class: 'share-actions' }, [send, drop]),
    ]),
  ]);
  document.body.append(sheet);
}
