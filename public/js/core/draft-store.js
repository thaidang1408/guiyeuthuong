// Lưu bản nháp (cả ảnh) vào IndexedDB để lỡ đóng tab vẫn làm tiếp được.
// Ảnh lưu dạng ArrayBuffer thay vì Blob vì Safari cũ/trình duyệt nhúng lưu Blob không ổn định.

const DB_NAME = 'thiep-nhap';
const STORE = 'drafts';

let dbPromise;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('no-idb'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/**
 * Bản nháp: { template, step, data, images: [{ id, type, buf }], music?: { name, type, buf }, updatedAt }
 */
export async function loadDraft(templateId) {
  try {
    return (await tx('readonly', (s) => s.get(templateId))) || null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft) {
  draft.updatedAt = Date.now();
  await tx('readwrite', (s) => s.put(draft, draft.template));
}

export async function clearDraft(templateId) {
  try {
    await tx('readwrite', (s) => s.delete(templateId));
  } catch {
    /* không sao */
  }
}

/** Mẫu thiệp người dùng làm gần nhất (để trang xem trước biết mở nháp nào). */
export function rememberLastTemplate(templateId) {
  try {
    localStorage.setItem('mau-gan-nhat', templateId);
  } catch {
    /* không sao */
  }
}

export function lastTemplate() {
  try {
    return localStorage.getItem('mau-gan-nhat');
  } catch {
    return null;
  }
}

/** Đổi ảnh/nhạc đã lưu ({ type, buf }) thành Blob. */
export const imageToBlob = (img) => new Blob([img.buf], { type: img.type });
