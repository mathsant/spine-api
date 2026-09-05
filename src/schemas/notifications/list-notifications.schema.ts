import { z } from 'zod';

/** Querystring of `GET /v1/me/notifications` (contracts/notifications.openapi.yaml → listNotifications). */
export const listNotificationsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
