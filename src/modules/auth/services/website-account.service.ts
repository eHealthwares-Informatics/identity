import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, MoreThan, Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { AuthActionTokenOrmEntity, type AuthActionPurpose } from '../entities/auth-action-token.orm-entity';
import { UserOrmEntity } from '../../users/entities/user.orm-entity';
import type { PasswordHasherPort } from './password-hasher.port';
import { PASSWORD_HASHER } from './identity.di-tokens';
import { ConversationClient } from './conversation-client.service';

const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Password-reset and email-verification for website shoppers. Tokens are
 * single-use and emailed through the Conversation Engine's channel API (the
 * channel is selected by `WEBSITE_EMAIL_CHANNEL_CODE`).
 */
@Injectable()
export class WebsiteAccountService {
  private readonly logger = new Logger(WebsiteAccountService.name);

  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepo: Repository<UserOrmEntity>,
    @InjectRepository(AuthActionTokenOrmEntity)
    private readonly tokenRepo: Repository<AuthActionTokenOrmEntity>,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    private readonly conversationClient: ConversationClient,
    private readonly configService: ConfigService,
  ) {}

  private emailChannelCode(): string {
    return this.configService.get<string>('WEBSITE_EMAIL_CHANNEL_CODE', 'email');
  }

  private appUrl(): string {
    return this.configService
      .get<string>('WEBSITE_APP_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
  }

  private findByEmail(email: string): Promise<UserOrmEntity | null> {
    return this.userRepo.findOne({ where: { email: ILike(email.trim()) } });
  }

  /** Always resolves ok — never reveals whether the email is registered. */
  async requestPasswordReset(rawEmail: string): Promise<{ sent: boolean }> {
    const user = await this.findByEmail(rawEmail);
    if (user?.email) {
      const token = await this.issueToken(user.id, 'password_reset', RESET_TTL_MS);
      const link = `${this.appUrl()}/shop/reset-password?token=${token}`;
      await this.trySend(
        user.email,
        'Reset your password',
        `Use this link to reset your password (valid for 30 minutes): ${link}`,
      );
    }
    return { sent: true };
  }

  async resetPassword(rawToken: string, password: string): Promise<{ reset: boolean }> {
    const row = await this.consumeToken(rawToken, 'password_reset');
    const passwordHash = await this.passwordHasher.hash(password);
    await this.userRepo.update({ id: row.userId }, { passwordHash });
    await this.tokenRepo.update({ id: row.id }, { consumedAt: new Date() });
    return { reset: true };
  }

  async requestEmailVerification(rawEmail: string): Promise<{ sent: boolean; alreadyVerified?: boolean }> {
    const user = await this.findByEmail(rawEmail);
    if (!user?.email) return { sent: true };
    if (user.emailVerifiedAt) return { sent: false, alreadyVerified: true };

    const token = await this.issueToken(user.id, 'email_verify', VERIFY_TTL_MS);
    const link = `${this.appUrl()}/shop/verify-email?token=${token}`;
    await this.trySend(
      user.email,
      'Verify your email',
      `Confirm your email address by opening this link (valid for 24 hours): ${link}`,
    );
    return { sent: true };
  }

  async verifyEmail(rawToken: string): Promise<{ verified: boolean }> {
    const row = await this.consumeToken(rawToken, 'email_verify');
    await this.userRepo.update({ id: row.userId }, { emailVerifiedAt: new Date() });
    await this.tokenRepo.update({ id: row.id }, { consumedAt: new Date() });
    return { verified: true };
  }

  /** Issue a fresh token, invalidating any outstanding one for the same purpose. */
  private async issueToken(
    userId: string,
    purpose: AuthActionPurpose,
    ttlMs: number,
  ): Promise<string> {
    await this.tokenRepo.update(
      { userId, purpose, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );
    const token = randomBytes(32).toString('hex');
    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId,
        purpose,
        tokenHash: await this.passwordHasher.hash(token),
        expiresAt: new Date(Date.now() + ttlMs),
        consumedAt: null,
      }),
    );
    return token;
  }

  /** Resolve an unconsumed, unexpired token; throws when invalid. */
  private async consumeToken(
    rawToken: string,
    purpose: AuthActionPurpose,
  ): Promise<AuthActionTokenOrmEntity> {
    const tokenHash = await this.passwordHasher.hash(rawToken.trim());
    const row = await this.tokenRepo.findOne({
      where: {
        tokenHash,
        purpose,
        consumedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    if (!row) throw new BadRequestException('This link is invalid or has expired');
    return row;
  }

  private async trySend(email: string, title: string, message: string): Promise<void> {
    try {
      await this.conversationClient.sendEmail(this.emailChannelCode(), email, title, message);
    } catch (error) {
      // Do not fail the request when the delivery channel is unavailable.
      this.logger.warn(`Could not send "${title}" email to ${email}: ${String(error)}`);
    }
  }
}
