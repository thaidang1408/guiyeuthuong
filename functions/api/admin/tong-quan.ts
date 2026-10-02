// GET /api/admin/tong-quan — doanh thu, đơn mới nhất, giao dịch cần xem, báo cáo.
import { buildServices } from '../../_lib/container.ts';
import type { Env } from '../../_lib/env.ts';
import { json } from '../../_lib/http/responses.ts';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => json(await buildServices(env).adminService.dashboard());
