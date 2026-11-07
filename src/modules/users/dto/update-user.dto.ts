import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { USER_GENDERS } from '../domains/user.entity';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'cashier01' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'N3wP@ss!' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: ['cashier', 'admin'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Assigned location UUID' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Per-user session timeout in minutes (null = system default)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  loginTimeoutMinutes?: number | null;

  // ── Profile ──────────────────────────────────────────────────
  // undefined leaves the stored value untouched; null clears it.

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
}
