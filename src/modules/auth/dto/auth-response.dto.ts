import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The signed-in account returned with a token pair. Storefronts use it to
 * greet the shopper and render their profile without a second `/auth/me` call.
 */
export class AuthUserDto {
  @ApiProperty()
  sub!: string;

  @ApiProperty()
  username!: string;

  /** "First Last", else the provider display name, else the username. */
  @ApiProperty({ example: 'Ada Lovelace' })
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  organizationId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  firstName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1990-04-18' })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'female' })
  gender?: string | null;

  @ApiPropertyOptional({ nullable: true })
  pictureUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'google' })
  oauthProvider?: string | null;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty()
  accessTokenExpiresIn!: number;

  @ApiProperty()
  refreshTokenExpiresIn!: number;

  /** Present on website/shopper sign-in (password, OTP and OAuth alike). */
  @ApiPropertyOptional({ type: AuthUserDto })
  user?: AuthUserDto;
}
