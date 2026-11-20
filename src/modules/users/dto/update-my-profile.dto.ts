import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { USER_GENDERS } from '../domains/user.entity';

/**
 * Self-service profile update for the signed-in user (`PATCH /users/me`).
 *
 * Deliberately narrower than `UpdateUserDto`: a user may edit their own basic
 * details (name, date of birth, gender, contact info) but never their roles,
 * password, active flag or username — those stay admin-only.
 */
export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'Ada', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string | null;

  @ApiPropertyOptional({ example: 'Lovelace', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string | null;

  @ApiPropertyOptional({
    example: '1990-04-18',
    nullable: true,
    description: 'Calendar date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ enum: USER_GENDERS, example: 'female', nullable: true })
  @IsOptional()
  @IsIn(USER_GENDERS)
  gender?: string | null;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsString()
  email?: string;
}
