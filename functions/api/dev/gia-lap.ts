// POST /api/dev/gia-lap — nút "Giả lập tiền về" (CHỈ chạy ở máy). Body: { code, mode: "du" | "thieu" }
import { buildServices } from '../../_lib/container.ts';
import { type Env, devToolsEnabled } from '../../_lib/env.ts';
import { readJson } from '../../_lib/http/requests.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Trên Cloudflare thật: giả vờ như đường dẫn này không tồn tại.
  if (!devToolsEnabled(env)) return json({ error: 'Không tìm thấy.' }, 404);
  const body = await readJson(request);
  const mode = body.mode === 'thieu' ? 'thieu' : 'du';
  return json(await buildServices(env).devSimulator.simulate(String(body.code ?? ''), mode));
};
