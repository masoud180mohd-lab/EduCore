import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';

import { NotificationsService } from '../application/notifications.service.js';

export const BEEM_WEBHOOK_SECRET_HEADER = 'x-beem-webhook-secret';

/**
 * Beem DLR webhook (COMMS-004 / ACF-014).
 * POST /api/v1/notifications/webhooks/beem — shared secret, no session.
 */
@Controller()
export class NotificationsWebhooksController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('api/v1/notifications/webhooks/beem')
  @HttpCode(200)
  async handleBeemWebhook(
    @Body() body: unknown,
    @Headers(BEEM_WEBHOOK_SECRET_HEADER) webhookSecret?: string,
  ): Promise<unknown> {
    return this.notificationsService.handleBeemWebhook(body, webhookSecret);
  }
}
