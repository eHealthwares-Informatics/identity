import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sends transactional messages (SMS / WhatsApp) through the conversation
 * service's channel API. The channel `code` selects the outbound sender.
 */
@Injectable()
export class ConversationClient {
  private readonly logger = new Logger(ConversationClient.name);

  constructor(private readonly configService: ConfigService) {}

  private baseUrl(): string {
    return this.configService
      .get<string>('CONVERSATION_SERVICE_URL', 'http://localhost:8090/api')
      .replace(/\/$/, '');
  }

  async send(
    code: string,
    phone: string,
    title: string,
    message: string,
    options?: { templateName?: string; components?: unknown[] },
  ): Promise<void> {
    await this.post({ code, phone, title, message }, options);
  }

  /**
   * Send a transactional email (e.g. a password-reset or verification link)
   * through the channel selected by `code`. Same channel API as [send], but
   * addressed by email instead of phone.
   */
  async sendEmail(
    code: string,
    email: string,
    title: string,
    message: string,
  ): Promise<void> {
    await this.post({ code, email, title, message });
  }

  private async post(
    recipient: { code: string; phone?: string; email?: string; title: string; message: string },
    options?: { templateName?: string; components?: unknown[] },
  ): Promise<void> {
    const url = `${this.baseUrl()}/channels/send-message`;
    try {
      const payload: Record<string, unknown> = { ...recipient };
      if (options?.templateName) payload.templateName = options.templateName;
      if (options?.components) payload.components = options.components;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`conversation responded ${res.status}: ${text}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to send ${recipient.code} message to ${recipient.phone ?? recipient.email}: ${error.message}`,
      );
      throw new BadRequestException('Could not send message');
    }
  }
}
