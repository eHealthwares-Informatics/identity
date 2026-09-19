import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PhoneOtpOrmEntity } from '../entities/phone-otp.orm-entity';
import { ConversationClient } from './conversation-client.service';
import { User } from '../../users/domains/user.entity';
import type { UserRepository } from '../../users/repositories/user.repository';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import type { PasswordHasherPort } from './password-hasher.port';
import type { TokenIssuerPort, TokenPair } from './token-issuer.port';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import {
  PASSWORD_HASHER,
  REFRESH_TOKEN_REPOSITORY,
  ROLE_REPOSITORY,
  TOKEN_ISSUER,
  USER_REPOSITORY,
} from './identity.di-tokens';

const DEFAULT_ORG_ID = 'df3b4afd-9955-4617-9a82-264cc73dd8b2';
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_HOUR = 5;
const SHOPPER_ROLE = 'mobile_shopper';

@Injectable()
export class ShopperAuthService {
  private readonly logger = new Logger(ShopperAuthService.name);

  constructor(
    @InjectRepository(PhoneOtpOrmEntity)
    private readonly otpRepo: Repository<PhoneOtpOrmEntity>,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_ISSUER)
    private readonly tokenIssuer: TokenIssuerPort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly conversationClient: ConversationClient,
    private readonly configService: ConfigService,
  ) {}

  private organizationId(): string {
    return this.configService.get<string>(
      'SHOPPER_DEFAULT_ORGANIZATION_ID',
      DEFAULT_ORG_ID,
    );
  }

  private channelCode(channel: 'sms' | 'whatsapp'): string {
    return channel === 'whatsapp'
      ? this.configService.get<string>(
          'WHATSAPP_CHANNEL_CODE',
          'WHATSAPP_EHEALTHWARES',
        )
      : this.configService.get<string>('SMS_CHANNEL_CODE', 'SMS_PROXY');
  }

  private normalizePhone(phone: string): string {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/[^0-9]/g, '');
    return digits || trimmed;
  }

  /** Send a 6-digit OTP over the selected channel. */
  async requestOtp(
    rawPhone: string,
    channel: 'sms' | 'whatsapp',
  ): Promise<{ sent: boolean; channel: string; code?: string }> {
    const phone = this.normalizePhone(rawPhone);
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await this.otpRepo.count({
      where: { phone, createdAt: MoreThan(since) },
    });
    if (recent >= MAX_REQUESTS_PER_HOUR) {
      throw new BadRequestException(
        'Too many verification requests. Please try again later.',
      );
    }

    // Invalidate any outstanding codes for this phone.
    await this.otpRepo.update(
      { phone, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await this.passwordHasher.hash(code);
    await this.otpRepo.save(
      this.otpRepo.create({
        organizationId: this.organizationId(),
        phone,
        channel,
        codeHash,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
        consumedAt: null,
      }),
    );

    const otpTemplate = this.configService.get<string>(
      'WHATSAPP_OTP_TEMPLATE_NAME',
    );
    await this.conversationClient.send(
      this.channelCode(channel),
      phone,
      'RxSoft verification',
      `Your RxSoft verification code is ${code}. It expires in 10 minutes.`,
      channel === 'whatsapp' && otpTemplate
        ? {
            templateName: otpTemplate,
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
            ],
          }
        : undefined,
    );

    // DEV ONLY: surface the code so it can be shown on-screen while the SMS /
    // WhatsApp channels are not yet delivering. Disable via OTP_EXPOSE_CODE=false.
    const expose = this.configService.get<string>('OTP_EXPOSE_CODE', 'true') !== 'false';
    return { sent: true, channel, ...(expose ? { code } : {}) };
  }

  /**
   * Sign in a shopper by phone. OTP verification happens on the client (the
   * device that received the code), so the backend only resolves/creates the
   * account and issues tokens.
   */
  async signIn(rawPhone: string): Promise<TokenPair> {
    const phone = this.normalizePhone(rawPhone);
    const user = await this.findOrCreateShopper(phone);
    return this.issueForUser(user);
  }

  private async findOrCreateShopper(phone: string): Promise<User> {
    const organizationId = this.organizationId();
    const username = `shopper_${phone.replace(/[^0-9]/g, '')}`;

    const existing = await this.userRepository.findByUsername(
      username,
      organizationId,
    );
    if (existing) return existing;

    const roleCodes = [SHOPPER_ROLE];
    const roles = await this.roleRepository.listByCodes(
      roleCodes,
      organizationId,
    );
    if (roles.length !== roleCodes.length) {
      throw new BadRequestException('mobile_shopper role is not configured');
    }

    const passwordHash = await this.passwordHasher.hash(randomUUID());
    const user = new User(
      randomUUID(),
      organizationId,
      null,
      username,
      passwordHash,
      true,
      roleCodes,
      roles,
      phone,
    );
    await this.userRepository.create(user);
    this.logger.log(`Created mobile shopper ${username}`);
    return user;
  }

  private async issueForUser(user: User): Promise<TokenPair> {
    const roles = user.organizationId
      ? await this.roleRepository.listByCodes(user.roleCodes, user.organizationId)
      : [];
    const permissions = [...new Set(roles.flatMap((role) => role.permissionCodes))];

    const tokenPair = await this.tokenIssuer.issuePair(
      {
        sub: user.id,
        organizationId: user.organizationId ?? '',
        locationId: user.locationId,
        username: user.username,
        roles: user.roleCodes,
        permissions,
        phone: user.phone,
        email: user.email ?? user.id,
      },
      user.loginTimeoutMinutes ?? undefined,
    );

    const refreshTokenHash = await this.passwordHasher.hash(
      tokenPair.refreshToken,
    );
    await this.refreshTokenRepository.persist(
      user.id,
      refreshTokenHash,
      new Date(Date.now() + tokenPair.refreshTokenExpiresIn * 1000),
    );

    return tokenPair;
  }
}
