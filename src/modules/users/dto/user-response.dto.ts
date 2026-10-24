import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  organizationId!: string | null;

  @ApiProperty({ nullable: true })
  locationId!: string | null;

  @ApiProperty()
  username!: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty()
  roles!: string[];

  @ApiProperty()
  isActive!: boolean;

  @ApiPropertyOptional({ nullable: true })
  loginTimeoutMinutes?: number | null;

  @ApiPropertyOptional({ nullable: true })
  firstName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '1990-04-18' })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ nullable: true })
  gender?: string | null;

  @ApiPropertyOptional({ nullable: true })
  pictureUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  locale?: string | null;

  @ApiPropertyOptional({ nullable: true })
  oauthProvider?: string | null;
}
