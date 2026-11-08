import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { USER_GENDERS } from '../domains/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'cashier01' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'P@ssw0rd!' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: '+1234567890' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Assigned location UUID' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ example: ['cashier'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleCodes?: string[];

  @ApiPropertyOptional({ description: 'Per-user session timeout in minutes (null = system default)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  loginTimeoutMinutes?: number | null;

  // ── Profile ──────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'Ada' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string | null;

  @ApiPropertyOptional({ example: 'Lovelace' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string | null;

  @ApiPropertyOptional({ example: '1990-04-18', description: 'Calendar date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ enum: USER_GENDERS, example: 'female' })
  @IsOptional()
  @IsIn(USER_GENDERS)
  gender?: string | null;
}
