import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RequestUser } from '../../../common/decorators/current-user.decorator';
import type { PasswordHasherPort } from '../../auth/services/password-hasher.port';
import {
  PASSWORD_HASHER,
  ROLE_REPOSITORY,
  USER_REPOSITORY,
} from '../../auth/services/identity.di-tokens';
import type { RoleRepository } from '../../roles/repositories/role.repository';
import { User } from '../domains/user.entity';
import { EnsureCustomerUserDto } from '../dto/ensure-customer-user.dto';
import type { UserRepository } from '../repositories/user.repository';

const CUSTOMER_ROLE = 'website_user';
const SHOPPER_USERNAME_PREFIX = 'shopper_';

/**
 * Phone formats the same person may appear under (local 0-prefixed vs country
 * code). Stored users use digits only (matching the website OTP flow).
 */
function phoneVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  const variants = new Set<string>([trimmed, digits]);
  if (digits.startsWith('0') && digits.length === 11) {
    variants.add(`234${digits.slice(1)}`);
  }
  if (digits.startsWith('234') && digits.length === 13) {
    variants.add(`0${digits.slice(3)}`);
  }
  if (digits.length === 10) {
    variants.add(`234${digits}`);
  }
  return [...variants].filter(Boolean);
}

/**
 * Find or create the website user for a customer's phone number.
 *
 * Idempotent by design: customers are created once but payment-link generation
 * may run many times, and concurrent requests must not create duplicate users.
 * The username matches the one website OTP sign-in uses (`shopper_<digits>`),
 * so a customer who later signs in by OTP lands on the same account.
 */
@Injectable()
export class EnsureCustomerUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(
    payload: EnsureCustomerUserDto,
    currentUser: RequestUser,
  ): Promise<User> {
    const organizationId =
      currentUser.sub === 'system'
        ? payload.organizationId || currentUser.organizationId || ''
        : currentUser.organizationId || '';
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    const phone = payload.phone?.trim();
    if (!phone) {
      throw new BadRequestException('phone is required');
    }
    const digits = phone.replace(/[^0-9]/g, '') || phone;

    for (const variant of phoneVariants(phone)) {
      const byPhone = await this.userRepository.findByPhone(variant, organizationId);
      if (byPhone) return byPhone;
    }

    const email = payload.email?.trim().toLowerCase() || undefined;
    if (email) {
      const byEmail = await this.userRepository.findByEmail(email, organizationId);
      if (byEmail) return byEmail;
    }

    const username = `${SHOPPER_USERNAME_PREFIX}${digits}`;
    const byUsername = await this.userRepository.findByUsername(username, organizationId);
    if (byUsername) return byUsername;

    const roleCodes = [CUSTOMER_ROLE];
    const roles = await this.roleRepository.listByCodes(roleCodes, organizationId);
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
      digits,
      email,
    );

    try {
      return await this.userRepository.create(user);
    } catch (err) {
      // A concurrent caller may have created the account between the checks.
      for (const variant of phoneVariants(phone)) {
        const raced = await this.userRepository.findByPhone(variant, organizationId);
        if (raced) return raced;
      }
      const racedByUsername = await this.userRepository.findByUsername(
        username,
        organizationId,
      );
      if (racedByUsername) return racedByUsername;
      throw err;
    }
  }
}
