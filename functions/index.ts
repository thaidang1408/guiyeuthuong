// GET / — trang chủ tĩnh, chỉ đổi ảnh xem trước (og:image) sang địa chỉ đầy đủ:
// Facebook/Zalo/Messenger không nhận đường dẫn tương đối khi hiện khung xem trước link.
import type { Env } from './_lib/env.ts';
import { canonicalUrl } from '../public/js/shared/site.js';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const page = await env.ASSETS.fetch(request);
  if (!page.headers.get('Content-Type')?.includes('text/html')) return page;
  // Link phiên bản (có mã phía trước) → ảnh xem trước vẫn dùng địa chỉ chính thức.
  const origin = new URL(canonicalUrl(request.url) ?? request.url).origin;
  return new HTMLRewriter()
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute('content', `${origin}/img/og-home.jpg`);
      },
    })
    .transform(page);
};
