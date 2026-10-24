/**
 * Profile attributes collected from an identity provider (Google / Facebook)
 * or the admin UI. Every field is optional: password and OTP sign-ups have no
 * profile data, and providers only return what the user consented to share.
 */
export type UserProfile = {
  firstName?: string | null;
  lastName?: string | null;
  /** Provider "name" claim — the name as the user wants to be addressed. */
  displayName?: string | null;
  /** ISO calendar date (YYYY-MM-DD). Providers never supply a time zone. */
  dateOfBirth?: string | null;
  gender?: string | null;
  pictureUrl?: string | null;
  locale?: string | null;
  /** Provider that proved this identity, e.g. 'google' | 'facebook'. */
  oauthProvider?: string | null;
  /** Provider's stable subject id (Google `sub`, Facebook `id`). */
  oauthProviderId?: string | null;
  emailVerifiedAt?: Date | null;
};

export class User {
  constructor(
    public readonly id: string,
    public readonly organizationId: string | null,
    public readonly locationId: string | null,
    public readonly username: string,
    public passwordHash: string,
    public readonly isActive: boolean,
    public roleCodes: string[] = [],
    public roles: any[] = [],
    public phone?: string,
    public readonly email?: string,
    public readonly loginTimeoutMinutes?: number | null,
    public profile: UserProfile = {},
  ) {}

  /** "First Last" when known, otherwise the provider's display name. */
  get fullName(): string | null {
    const joined = [this.profile.firstName, this.profile.lastName]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' ')
      .trim();
    return joined || this.profile.displayName?.trim() || null;
  }
}
