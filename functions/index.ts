// GET / — trang chủ tĩnh, chỉ đổi ảnh xem trước (og:image) sang địa chỉ đầy đủ:
// Facebook/Zalo/Messenger không nhận đường dẫn tương đối khi hiện khung xem trước link.
import type { Env } from './_lib/env.ts';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const page = await env.ASSETS.fetch(request);
  if (!page.headers.get('Content-Type')?.includes('text/html')) return page;
  const origin = new URL(request.url).origin;
  return new HTMLRewriter()
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute('content', `${origin}/img/og-home.jpg`);
      },
    })
    .transform(page);
};
