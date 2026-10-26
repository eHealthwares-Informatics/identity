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
import { randomBytes, randomUUID } from 'node:crypto';
import { compressPermissions } from '../../../common/utils/permission-set';
import { PhoneOtpOrmEntity } from '../entities/phone-otp.orm-entity';
import { User, type UserProfile } from '../../users/domains/user.entity';
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

/** OAuth sign-in channels. Each maps to its own org/role env overrides. */
export type OAuthChannel = 'website' | 'console' | 'shopper' | 'emr';

export type OAuthChannelConfig = {
  organizationId: string;
  roleCodes: string[];
};

export type OAuthProvider = 'google' | 'facebook';

/**
 * Normalised identity-provider profile. Everything except the provider id is
 * optional because providers only return the claims the user consented to.
 * Profile attributes are mapped onto the user row on sign-up and used to fill
 * blanks on subsequent sign-ins (existing values are never overwritten).
 */
export type OAuthUserInfo = {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string | null;
  /** True when the provider vouched for the email address. */
  emailVerified?: boolean;
  /** The provider's `name` claim — how the user wants to be addressed. */
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  pictureUrl?: string | null;
  locale?: string | null;
  gender?: string | null;
  /** ISO calendar date (YYYY-MM-DD). */
  dateOfBirth?: string | null;
  phone?: string | null;
};

/** Subset of Google's OIDC userinfo / tokeninfo response we consume. */
type GoogleProfileClaims = {
  sub?: string;
  user_id?: string;
  email?: string | null;
  email_verified?: boolean | string;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  picture?: string | null;
  locale?: string | null;
};

/** Subset of the Google People API `people/me` response we consume. */
type GooglePerson = {
  names?: Array<{ givenName?: string; familyName?: string; displayName?: string; metadata?: { primary?: boolean } }>;
  birthdays?: Array<{
    date?: { year?: number; month?: number; day?: number };
    metadata?: { primary?: boolean };
  }>;
  genders?: Array<{ value?: string; formattedValue?: string; metadata?: { primary?: boolean } }>;
  phoneNumbers?: Array<{ value?: string; canonicalForm?: string; metadata?: { primary?: boolean } }>;
  locales?: Array<{ value?: string; metadata?: { primary?: boolean } }>;
  photos?: Array<{ url?: string; metadata?: { primary?: boolean } }>;
};

/** Subset of the Facebook Graph `me` response we consume. */
type FacebookProfile = {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  email?: string;
  email_verified?: boolean | string;
  birthday?: string;
  gender?: string;
  locale?: string;
  picture?: { data?: { url?: string; is_silhouette?: boolean } };
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

  /**
   * Per-channel OAuth sign-in configuration. Channels map to env keys named
   * `<CHANNEL>_OAUTH_ORGANIZATION_ID` and `<CHANNEL>_OAUTH_ROLES` (CSV);
   * when unset the shopper defaults are used so existing website behaviour
   * is unchanged.
   */
  /**
   * Per-channel OAuth sign-in configuration. Channels map to env keys named
   * `OAUTH_<CHANNEL>_ORGANIZATION_ID` and `OAUTH_<CHANNEL>_ROLES` (CSV);
   * when unset the shopper defaults are used so existing website behaviour
   * is unchanged.
   */
  private channelConfig(channel: OAuthChannel): OAuthChannelConfig {
    const prefix = channel.toUpperCase();
    const organizationId =
      this.configService.get<string>(`OAUTH_${prefix}_ORGANIZATION_ID`) ||
      this.organizationId();
    const roleCsv =
      this.configService.get<string>(`OAUTH_${prefix}_ROLES`) || WEBSITE_ROLE;
    const roleCodes = roleCsv.split(',').map((c) => c.trim()).filter(Boolean);
    return { organizationId, roleCodes };
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
      // Conversation engine API: POST /channels/send-message { code, phone, title, message }
      const response = await fetch(`${conversationUrl}/channels/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: channelCode,
          phone,
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
    return this.oauthSignIn(await this.fetchGoogleUserInfo(accessToken));
  }

  /**
   * Sign in (or auto-register) via a verified Google ID token — the credential
   * issued by Android Credential Manager / One Tap when the app signs in with
   * Google. The JWT is verified against Google's tokeninfo endpoint and its
   * audience must match our web OAuth client (GOOGLE_WEB_CLIENT_ID).
   */
  async googleSignInWithIdToken(idToken: string): Promise<TokenPair> {
    return this.oauthSignIn(await this.googleProfileFromIdToken(idToken));
  }

  /** Web OAuth client the app sets as Credential Manager `serverClientId`. */
  private googleWebClientId(): string {
    return this.configService.get<string>(
      'GOOGLE_WEB_CLIENT_ID',
      '763036387173-jml5o3iauj2ms5269dqf7qq24gplh6mq.apps.googleusercontent.com',
    );
  }

  /**
   * Verify a Google ID token (JWS) and return its principal claims. Uses
   * Google's public tokeninfo endpoint (signature validated server-side by
   * Google); we enforce audience, issuer, expiry and verified email here.
   */
  private async verifyGoogleIdToken(
    idToken: string,
  ): Promise<GoogleProfileClaims & { sub: string }> {
    this.logger.debug(`Google tokeninfo request initiated for token`);
    let response: Response;
    try {
      response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
    } catch (error) {
      this.logger.warn(`Google tokeninfo request failed: ${String(error)}`);
      throw new UnauthorizedException('Could not verify Google account');
    }
    if (!response.ok) {
      this.logger.debug(`Google tokeninfo returned ${response.status}`);
      throw new UnauthorizedException('Invalid Google token');
    }
    const data = (await response.json()) as Record<string, unknown>;

    const aud = Array.isArray(data.aud) ? data.aud : [data.aud];
    if (!aud.includes(this.googleWebClientId())) {
      throw new UnauthorizedException(
        'Google token was issued for a different app',
      );
    }
    if (
      data.iss !== 'accounts.google.com' &&
      data.iss !== 'https://accounts.google.com'
    ) {
      throw new UnauthorizedException('Invalid Google token issuer');
    }
    const exp = Number(data.exp);
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Google token has expired');
    }
    const sub =
      typeof data.sub === 'string'
        ? data.sub
        : typeof data.user_id === 'string'
          ? data.user_id
          : undefined;
    if (!sub) {
      throw new UnauthorizedException('Google account has no identifier');
    }
    // Only link accounts by email when Google says the address is verified.
    const email =
      typeof data.email === 'string' &&
      (data.email_verified === true || data.email_verified === 'true')
        ? data.email
        : undefined;
    return {
      sub,
      email,
      name: WebsiteAuthService.text(data.name),
      given_name: WebsiteAuthService.text(data.given_name),
      family_name: WebsiteAuthService.text(data.family_name),
      picture: WebsiteAuthService.text(data.picture),
      locale: WebsiteAuthService.text(data.locale),
    };
  }

  /** Map verified Google ID-token claims onto the normalised OAuth profile. */
  private googleProfileFromClaims(
    claims: GoogleProfileClaims & { sub: string },
  ): OAuthUserInfo {
    const email = WebsiteAuthService.text(claims.email);
    const given = WebsiteAuthService.text(claims.given_name);
    const family = WebsiteAuthService.text(claims.family_name);
    const display = WebsiteAuthService.text(claims.name);
    const split = WebsiteAuthService.splitName(display);
    return {
      provider: 'google',
      providerUserId: claims.sub,
      email,
      emailVerified: Boolean(email),
      name: display,
      firstName: given ?? split.firstName,
      lastName: family ?? split.lastName,
      pictureUrl: WebsiteAuthService.text(claims.picture),
      locale: WebsiteAuthService.text(claims.locale),
    };
  }

  private async googleProfileFromIdToken(idToken: string): Promise<OAuthUserInfo> {
    return this.googleProfileFromClaims(await this.verifyGoogleIdToken(idToken));
  }

  /**
   * Sign in (or auto-register) via a verified Google identity for a specific
   * consumer channel (website shoppers by default; consoles / mobile apps
   * pass their own channel which may resolve a different org + role set).
   * Existing accounts of ANY role are linked by verified email; first-time
   * identities are auto-registered in the channel's configured org/role.
   */
  async oauthGoogleSignInForChannel(
    payload: { accessToken?: string; idToken?: string },
    channel: OAuthChannel,
  ): Promise<TokenPair> {
    if (!payload.idToken && !payload.accessToken) {
      throw new BadRequestException('Provide a Google accessToken or idToken');
    }
    const info = payload.idToken
      ? await this.googleProfileFromIdToken(payload.idToken)
      : await this.fetchGoogleUserInfo(payload.accessToken as string);
    return this.oauthSignIn(info, channel);
  }

  /** See oauthGoogleSignInForChannel — Facebook access-token variant. */
  async oauthFacebookSignInForChannel(
    accessToken: string,
    channel: OAuthChannel,
  ): Promise<TokenPair> {
    return this.oauthSignIn(await this.fetchFacebookUserInfo(accessToken), channel);
  }

  /** Sign in (or auto-register) via a verified Facebook identity. */
  async facebookSignIn(accessToken: string): Promise<TokenPair> {
    return this.oauthSignIn(await this.fetchFacebookUserInfo(accessToken));
  }

  /**
   * Full Google profile for an access token: the OIDC userinfo claims
   * (name parts, photo, locale) plus, when the token carries the broader
   * People scopes, birthday / gender / phone from the People API.
   */
  private async fetchGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    let response: Response;
    try {
      this.logger.debug(`Google userinfo request initiated with access token`);
      response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (error) {
      this.logger.warn(`Google userinfo request failed: ${String(error)}`);
      throw new UnauthorizedException('Could not verify Google account');
    }
    if (!response.ok) {
      this.logger.debug(`Google userinfo returned ${response.status}`);
      throw new UnauthorizedException('Invalid Google token');
    }
    const data = (await response.json()) as GoogleProfileClaims;
    const providerUserId = WebsiteAuthService.text(data.sub);
    if (!providerUserId) {
      throw new UnauthorizedException('Google account has no identifier');
    }

    const profile = this.googleProfileFromClaims({
      ...data,
      sub: providerUserId,
      // Drop the address only when Google explicitly says it is unverified.
      email:
        data.email_verified === false || data.email_verified === 'false'
          ? undefined
          : data.email,
    });

    // Best effort: these claims come from a different API and are simply
    // absent when the client did not request the matching scopes.
    const extended = await this.fetchGooglePeopleProfile(accessToken);
    return { ...profile, ...extended };
  }

  /**
   * Extended Google profile via the People API. Requires the `user.birthday.read`
   * (and friends) scopes; tokens issued for plain openid/email/profile get a
   * 403 here, which is expected and never fails the sign-in.
   */
  private async fetchGooglePeopleProfile(
    accessToken: string,
  ): Promise<Partial<OAuthUserInfo>> {
    const personFields = 'names,birthdays,genders,phoneNumbers,locales,photos';
    try {
      this.logger.debug(`Google People API request initiated, fields: ${personFields}`);
      const response = await fetch(
        `https://people.googleapis.com/v1/people/me?personFields=${personFields}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!response.ok) {
        this.logger.debug(`Google People API returned ${response.status}; skipping extended profile`);
        return {};
      }
      const person = (await response.json()) as GooglePerson;
      const name = WebsiteAuthService.primary(person.names);
      const birthday = WebsiteAuthService.primary(
        // A birthday without a year cannot become a date of birth.
        person.birthdays?.filter((entry) => entry.date?.year),
      )?.date;
      const gender = WebsiteAuthService.primary(person.genders);
      const phone = WebsiteAuthService.primary(person.phoneNumbers);
      const locale = WebsiteAuthService.primary(person.locales);
      const photo = WebsiteAuthService.primary(person.photos);

      return WebsiteAuthService.compact({
        name: WebsiteAuthService.text(name?.displayName),
        firstName: WebsiteAuthService.text(name?.givenName),
        lastName: WebsiteAuthService.text(name?.familyName),
        dateOfBirth: WebsiteAuthService.formatDate(
          birthday?.year,
          birthday?.month,
          birthday?.day,
        ),
        gender: WebsiteAuthService.text(gender?.formattedValue ?? gender?.value),
        phone: WebsiteAuthService.text(phone?.canonicalForm ?? phone?.value),
        locale: WebsiteAuthService.text(locale?.value),
        pictureUrl: WebsiteAuthService.text(photo?.url),
      });
    } catch (error) {
      this.logger.debug(`Google People API request failed: ${String(error)}`);
      return {};
    }
  }

  /**
   * Full Facebook profile. `birthday` and `gender` need extra permissions many
   * apps are not approved for, and Facebook rejects the whole query when a
   * field is unavailable — so fall back to the always-available field set.
   */
  private async fetchFacebookUserInfo(
    accessToken: string,
  ): Promise<OAuthUserInfo> {
    this.logger.debug(`Facebook userinfo request initiated, access token length: ${accessToken?.length ?? 0}`);
    const baseFields =
      'id,name,first_name,last_name,email,locale,picture.type(large)';
    const data =
      (await this.graphRequest(`${baseFields}`, accessToken)) ??
      (await this.graphRequest(baseFields, accessToken));
  
    if (!data) {
      this.logger.debug(`Invalid facebook token, AccessToken length: ${accessToken?.length ?? 0}`);
      throw new UnauthorizedException('Invalid Facebook token - ' + accessToken);
    }
    const providerUserId = WebsiteAuthService.text(data.id);
    if (!providerUserId) {
      throw new UnauthorizedException('Facebook account has no identifier');
    }

    const email =
      data.email_verified === false || data.email_verified === 'false'
        ? null
        : WebsiteAuthService.text(data.email);
    const split = WebsiteAuthService.splitName(data.name);
    return {
      provider: 'facebook',
      providerUserId,
      email,
      emailVerified: false,
      name: WebsiteAuthService.text(data.name),
      firstName: WebsiteAuthService.text(data.first_name) ?? split.firstName,
      lastName: WebsiteAuthService.text(data.last_name) ?? split.lastName,
      pictureUrl: WebsiteAuthService.text(data.picture?.data?.url),
      locale: WebsiteAuthService.text(data.locale),
      gender: WebsiteAuthService.text(data.gender),
      dateOfBirth: WebsiteAuthService.normalizeDate(data.birthday),
    };
  }

  /** Graph `me` node; resolves null when Facebook rejects the field set. */
  private async graphRequest(
    fields: string,
    accessToken: string,
  ): Promise<FacebookProfile | null> {
    try {
      this.logger.debug(`Facebook graph request initiated, fields: ${fields}`);
      const params = new URLSearchParams({ fields, access_token: accessToken });
      const response = await fetch(
        `https://graph.facebook.com/me?${params.toString()}`,
      );
      if (!response.ok) {
        this.logger.debug(`Facebook graph returned ${response.status}`);
        return null;
      }
      return (await response.json()) as FacebookProfile;
    } catch (error) {
      this.logger.warn(`Facebook graph request failed: ${String(error)}`);
      return null;
    }
  }

  private static text(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private static splitName(
    name?: string | null,
  ): { firstName: string | null; lastName: string | null } {
    const value = WebsiteAuthService.text(name);
    if (!value) return { firstName: null, lastName: null };
    const parts = value.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: null };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  /** Provider lists are unordered; prefer the entry flagged primary. */
  private static primary<T extends { metadata?: { primary?: boolean } }>(
    items?: T[],
  ): T | undefined {
    if (!items?.length) return undefined;
    return items.find((item) => item.metadata?.primary) ?? items[0];
  }

  private static compact<T extends Record<string, unknown>>(
    source: T,
  ): Partial<T> {
    return Object.fromEntries(
      Object.entries(source).filter(([, value]) => value !== null && value !== undefined),
    ) as Partial<T>;
  }

  private static formatDate(
    year?: number,
    month?: number,
    day?: number,
  ): string | null {
    if (!year || !month || !day) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date.toISOString().slice(0, 10);
  }

  /** Normalise ISO / MM/DD/YYYY / Date-like provider values to YYYY-MM-DD. */
  private static normalizeDate(raw: unknown): string | null {
    const value = WebsiteAuthService.text(raw);
    if (!value) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) return WebsiteAuthService.formatDate(+iso[1], +iso[2], +iso[3]);
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (us) return WebsiteAuthService.formatDate(+us[3], +us[1], +us[2]);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return null;
  }

  /**
   * Resolve an OAuth identity to a local account. Lookup order: the stored
   * provider link, the legacy `google_<sub>` username, then the verified
   * email. Auto-registers when no account exists yet and refreshes the profile
   * columns on every later sign-in. Tokens are issued like a password login.
   */
  private async oauthSignIn(
    info: OAuthUserInfo,
    channel: OAuthChannel = 'website',
  ): Promise<TokenPair> {
    const { organizationId, roleCodes: configuredRoles } =
      this.channelConfig(channel);

    const existing = await this.findOAuthAccount(info, organizationId);
    if (existing) {
      const synced = this.syncProfile(existing, info);
      const saved = synced ? await this.userRepository.update(synced) : existing;
      return this.issueForUser(saved);
    }

    const roles = await this.roleRepository.listByCodes(
      configuredRoles,
      organizationId,
    );
    if (roles.length !== configuredRoles.length) {
      throw new BadRequestException(
        `OAuth role(s) not configured for channel ${channel}`,
      );
    }

    // The handle is built from the person's own details instead of the opaque
    // provider subject so staff can recognise the account.
    const username = await this.uniqueUsername(
      this.usernameBase(info),
      organizationId,
    );
    const user = new User(
      randomUUID(),
      organizationId,
      null,
      username,
      await this.oauthPasswordHash(),
      true,
      configuredRoles,
      roles,
      info.phone ?? undefined,
      info.email ?? undefined,
      undefined,
      this.profileFromInfo(info),
    );
    await this.userRepository.create(user);
    this.logger.log(`Created ${info.provider} user ${username} (${channel})`);
    return this.issueForUser(user);
  }

  /** Match an existing account for a provider identity, most specific first. */
  private async findOAuthAccount(
    info: OAuthUserInfo,
    organizationId: string,
  ): Promise<User | null> {
    const linked = await this.userRepository.findByOAuthProvider(
      info.provider,
      info.providerUserId,
      organizationId,
    );
    if (linked) return linked;

    // Accounts registered before the provider link was persisted.
    const legacy = await this.userRepository.findByUsername(
      `${info.provider}_${info.providerUserId}`,
      organizationId,
    );
    if (legacy) return legacy;

    if (info.email) {
      // Link any existing account role — the verified email is the key.
      return this.userRepository.findByEmail(
        info.email.toLowerCase(),
        organizationId,
      );
    }
    return null;
  }

  /**
   * OAuth accounts get a random, never-revealed password so the credential
   * column is populated; entry is through the provider (or a password reset).
   */
  private async oauthPasswordHash(): Promise<string> {
    return this.passwordHasher.hash(randomBytes(32).toString('base64url'));
  }

  /** Profile columns for a brand-new OAuth account. */
  private profileFromInfo(info: OAuthUserInfo): UserProfile {
    const fullName =
      [info.firstName, info.lastName].filter(Boolean).join(' ') || info.name;
    return {
      firstName: info.firstName ?? null,
      lastName: info.lastName ?? null,
      displayName: fullName ?? null,
      dateOfBirth: info.dateOfBirth ?? null,
      gender: info.gender ?? null,
      pictureUrl: info.pictureUrl ?? null,
      locale: info.locale ?? null,
      oauthProvider: info.provider,
      oauthProviderId: info.providerUserId,
      emailVerifiedAt: info.email && info.emailVerified !== false ? new Date() : null,
    };
  }

  /**
   * Fill blank profile columns from the provider and persist the result.
   * Existing values always win so a later sign-in never overwrites edits made
   * in the admin UI. Returns the user only when something changed.
   */
  private syncProfile(user: User, info: OAuthUserInfo): User | null {
    const current: UserProfile = { ...(user.profile ?? {}) };
    const next: UserProfile = { ...current };
    const fill = (key: keyof UserProfile, value: string | null | undefined) => {
      const existing = next[key];
      const filled = typeof existing === 'string' && existing.trim().length > 0;
      if (value && !filled) (next[key] as string) = value;
    };

    fill('firstName', info.firstName);
    fill('lastName', info.lastName);
    fill('displayName', info.name);
    fill('dateOfBirth', info.dateOfBirth);
    fill('gender', info.gender);
    fill('pictureUrl', info.pictureUrl);
    fill('locale', info.locale);
    // The provider link is authoritative for this identity.
    fill('oauthProvider', info.provider);
    fill('oauthProviderId', info.providerUserId);
    if (!next.emailVerifiedAt && info.email && info.emailVerified !== false) {
      next.emailVerifiedAt = new Date();
    }
    if (!next.displayName) {
      const combined = [next.firstName, next.lastName]
        .filter(Boolean)
        .join(' ');
      if (combined) next.displayName = combined;
    }

    const phone = !user.phone && info.phone ? info.phone : user.phone;
    const changed =
      phone !== user.phone ||
      (Object.keys(next) as (keyof UserProfile)[]).some(
        (key) => next[key] !== current[key],
      );
    if (!changed) return null;

    user.profile = next;
    user.phone = phone;
    return user;
  }

  /** Username stem from the provider profile: full name, then email. */
  private usernameBase(info: OAuthUserInfo): string {
    const candidates = [
      [info.firstName, info.lastName].filter(Boolean).join('.'),
      info.email ? info.email.split('@')[0] : '',
      info.name ?? '',
      `${info.provider}.${info.providerUserId}`,
    ];
    for (const candidate of candidates) {
      const slug = WebsiteAuthService.slug(candidate);
      if (slug) return slug;
    }
    return `user.${randomUUID().slice(0, 8)}`;
  }

  /** Lowercase handle: accents folded, everything else collapsed to dots. */
  private static slug(value?: string | null): string {
    if (!value) return '';
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .toLowerCase()
      .slice(0, 32)
      .replace(/\.+$/g, '');
  }

  /** Keep the derived username unique inside the org (appends 2, 3, …). */
  private async uniqueUsername(
    base: string,
    organizationId: string,
  ): Promise<string> {
    for (let attempt = 1; attempt <= 20; attempt++) {
      const candidate = attempt === 1 ? base : `${base}${attempt}`;
      const taken = await this.userRepository.findByUsername(
        candidate,
        organizationId,
      );
      if (!taken) return candidate;
    }
    return `${base}.${randomUUID().slice(0, 8)}`;
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
    // Minimal set: a parent grant covers its subtree, so children it already
    // covers are dropped rather than shipped in the token and /auth/me.
    const permissions = compressPermissions(roles.flatMap((role) => role.permissionCodes));

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
