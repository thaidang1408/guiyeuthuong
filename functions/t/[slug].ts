// GET /t/<slug> — trang thiệp cho người nhận.
// Lấy khung HTML tĩnh (public/thiep.html) rồi nhúng sẵn dữ liệu thiệp vào, để trang chỉ cần một lần tải.
import { buildServices } from '../_lib/container.ts';
import type { Env } from '../_lib/env.ts';
import { CARD_PAGE_CSP, jsonForHtml } from '../_lib/http/responses.ts';
import { canonicalUrl } from '../../public/js/shared/site.js';

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  // ?cung=gui: người tạo mở phía mình của thiệp "Mở cùng nhau" — không tính là người nhận đã mở.
  const countView = new URL(request.url).searchParams.get('cung') !== 'gui';
  const card = await buildServices(env).cardService.openForViewer(String(params.slug), { countView });
  const shell = await env.ASSETS.fetch(new URL('/thiep', request.url));

  // Ảnh xem trước khi gửi link qua Zalo/Messenger: phải là địa chỉ đầy đủ. Tiêu đề có tên người nhận cho thân mật.
  // Link phiên bản (có mã phía trước) → ảnh xem trước vẫn dùng địa chỉ chính thức.
  const origin = new URL(canonicalUrl(request.url) ?? request.url).origin;
  const ogTitle = card ? `💌 ${card.data.recipientName} ơi, có một tấm thiệp cho bạn` : null;
  const page = new HTMLRewriter()
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute('content', `${origin}/img/og-thiep.jpg`);
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        if (ogTitle) el.setAttribute('content', ogTitle);
      },
    })
    .on('script#card-data', {
      element(el) {
        el.setInnerContent(jsonForHtml(card), { html: true });
      },
    })
    .transform(shell);

  return new Response(page.body, {
    status: card ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': CARD_PAGE_CSP,
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
};
