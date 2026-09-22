import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PhoneOtpOrmEntity } from '../entities/phone-otp.orm-entity';
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
const MAX_VERIFY_ATTEMPTS = 5;
const WEBSITE_ROLE = 'website_user';

export type OAuthProvider = 'google' | 'facebook';

export type OAuthUserInfo = {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string | null;
  name?: string | null;
};

@Injectable()
export class WebsiteAuthService {
  private readonly logger = new Logger(WebsiteAuthService.name);

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
    private readonly configService: ConfigService,
  ) {}

  private organizationId(): string {
    return this.configService.get<string>(
      'SHOPPER_DEFAULT_ORGANIZATION_ID',
      DEFAULT_ORG_ID,
    );
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

    await this.deliverOtp(phone, channel, code);

    // DEV ONLY: surface the code so it can be shown on-screen while the SMS /
    // WhatsApp channels are not yet delivering. Disable via OTP_EXPOSE_CODE=false.
    const expose =
      this.configService.get<string>('OTP_EXPOSE_CODE', 'true') !== 'false';
    return { sent: true, channel, ...(expose ? { code } : {}) };
  }

  private async deliverOtp(
    phone: string,
    channel: 'sms' | 'whatsapp',
    code: string,
  ): Promise<void> {
    const conversationUrl = this.configService
      .get<string>('CONVERSATION_SERVICE_URL', 'http://localhost:8090/api')
      .replace(/\/$/, '');
    const channelCode = this.configService.get<string>(
      channel === 'whatsapp' ? 'WHATSAPP_CHANNEL_CODE' : 'SMS_CHANNEL_CODE',
      channel === 'whatsapp' ? 'WHATSAPP_EHEALTHWARES' : 'SMS_PROXY',
    );
    try {
      const response = await fetch(`${conversationUrl}/channels/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelCode,
          recipient: phone,
          title: 'Damorex verification',
          message: `Your Damorex verification code is ${code}. It expires in 10 minutes.`,
        }),
      });
      if (!response.ok) {
        this.logger.warn(
          `Conversation service returned ${response.status} sending OTP to ${phone}`,
        );
      }
    } catch (error) {
      // Never fail the OTP request because the delivery channel is down; the
      // code is still valid and (in dev) returned for on-screen display.
      this.logger.warn(
        `Could not forward OTP to conversation service: ${String(error)}`,
      );
    }
  }

  /** Verify the OTP server-side and issue tokens for the phone's account. */
  async verifyOtpAndSignIn(rawPhone: string, code: string): Promise<TokenPair> {
    const phone = this.normalizePhone(rawPhone);
    const normalizedCode = code.trim();

    const otp = await this.otpRepo.findOne({
      where: { phone, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    if (!otp) {
      throw new BadRequestException(
        'No active verification code. Request a new one.',
      );
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'Verification code expired. Request a new one.',
      );
    }
    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Request a new code.');
    }

    const matches = await this.passwordHasher.verify(
      normalizedCode,
      otp.codeHash,
    );
    if (!matches) {
      await this.otpRepo.update({ id: otp.id }, { attempts: otp.attempts + 1 });
      throw new BadRequestException('Invalid verification code.');
    }

    await this.otpRepo.update({ id: otp.id }, { consumedAt: new Date() });

    const user = await this.findOrCreateWebsiteUserByPhone(phone);
    return this.issueForUser(user);
  }

  /** Sign in (or auto-register) via a verified Google identity. */
  async googleSignIn(accessToken: string): Promise<TokenPair> {
    const info = await this.fetchGoogleUserInfo(accessToken);
    return this.oauthSignIn({
      provider: 'google',
      providerUserId: info.id,
      email: info.email ?? null,
      name: info.name ?? null,
    });
  }

  /** Sign in (or auto-register) via a verified Facebook identity. */
  async facebookSignIn(accessToken: string): Promise<TokenPair> {
    const info = await this.fetchFacebookUserInfo(accessToken);
    return this.oauthSignIn({
      provider: 'facebook',
      providerUserId: info.id,
      email: info.email ?? null,
      name: info.name ?? null,
    });
  }

  private async fetchGoogleUserInfo(
    accessToken: string,
  ): Promise<{ id: string; email?: string; name?: string }> {
    let response: Response;
    try {
      response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      this.logger.warn(`Google userinfo request failed: ${String(error)}`);
      throw new UnauthorizedException('Could not verify Google account');
    }
    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google token');
    }
    const data = (await response.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };
    if (!data.sub) {
      throw new UnauthorizedException('Google account has no identifier');
    }
    return { id: data.sub, email: data.email, name: data.name };
  }

  private async fetchFacebookUserInfo(
    accessToken: string,
  ): Promise<{ id: string; email?: string; name?: string }> {
    let response: Response;
    try {
      const params = new URLSearchParams({
        fields: 'id,name,email',
        access_token: accessToken,
      });
      response = await fetch(`https://graph.facebook.com/me?${params.toString()}`);
    } catch (error) {
      this.logger.warn(`Facebook graph request failed: ${String(error)}`);
      throw new UnauthorizedException('Could not verify Facebook account');
    }
    if (!response.ok) {
      throw new UnauthorizedException('Invalid Facebook token');
    }
    const data = (await response.json()) as {
      id?: string;
      email?: string;
      name?: string;
    };
    if (!data.id) {
      throw new UnauthorizedException('Facebook account has no identifier');
    }
    return { id: data.id, email: data.email, name: data.name };
  }

  /**
   * Resolve an OAuth identity to a local account. Lookup order: verified
   * email, then the provider-linked username. Auto-registers when no account
   * exists yet. Tokens are issued exactly like a password login.
   */
  private async oauthSignIn(info: OAuthUserInfo): Promise<TokenPair> {
    const organizationId = this.organizationId();

    if (info.email) {
      const byEmail = await this.userRepository.findByEmail(
        info.email.toLowerCase(),
        organizationId,
      );
      if (byEmail) return this.issueForUser(byEmail);
    }

    const username = `${info.provider}_${info.providerUserId}`;
    const existing = await this.userRepository.findByUsername(
      username,
      organizationId,
    );
    if (existing) return this.issueForUser(existing);

    const roleCodes = [WEBSITE_ROLE];
    const roles = await this.roleRepository.listByCodes(
      roleCodes,
      organizationId,
    );
    if (roles.length !== roleCodes.length) {
      throw new BadRequestException('Website user role not configured');
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
      undefined,
      info.email ?? undefined,
    );
    await this.userRepository.create(user);
    this.logger.log(`Created ${info.provider} website user ${username}`);
    return this.issueForUser(user);
  }

  private async findOrCreateWebsiteUserByPhone(phone: string): Promise<User> {
    const organizationId = this.organizationId();

    const byPhone = await this.userRepository.findByPhone(phone, organizationId);
    if (byPhone) return byPhone;

    const username = `shopper_${phone.replace(/[^0-9]/g, '')}`;
    const byUsername = await this.userRepository.findByUsername(
      username,
      organizationId,
    );
    if (byUsername) return byUsername;

    const roleCodes = [WEBSITE_ROLE];
    const roles = await this.roleRepository.listByCodes(
      roleCodes,
      organizationId,
    );
    if (roles.length !== roleCodes.length) {
      throw new BadRequestException('Website user role not configured');
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
    this.logger.log(`Created website user ${username} by OTP`);
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
