import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/**
 * Filters for the session audit trail (`GET /auth/sessions`).
 *
 * `userId` defaults to the caller; another user's sessions require admin or
 * super_admin. Times are ISO-8601 and filter on the login instant.
 */
export class SessionListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 25;

  @ApiPropertyOptional({ description: 'Another user’s id (admin / super_admin only)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: 'true = open sessions only, false = closed only, omitted = both',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsBooleanString()
  active?: string;

  @ApiPropertyOptional({ description: 'Sessions used from this IP (login or last refresh)' })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({ description: 'Only sessions that started at/after this ISO timestamp' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Only sessions that started at/before this ISO timestamp' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    enum: ['loginAt', 'lastRefreshAt', 'logoutAt', 'createdAt'],
    default: 'loginAt',
  })
  @IsOptional()
  @IsIn(['loginAt', 'lastRefreshAt', 'logoutAt', 'createdAt'])
  sortBy?: 'loginAt' | 'lastRefreshAt' | 'logoutAt' | 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

export class SessionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() username!: string;
  @ApiPropertyOptional({ nullable: true }) organizationId!: string | null;
  @ApiProperty({ enum: ['console', 'website', 'shopper', 'emr', 'unknown'] })
  channel!: string;
  @ApiProperty({ enum: ['password', 'otp', 'oauth_google', 'oauth_facebook', 'unknown'] })
  loginMethod!: string;
  @ApiProperty() loginAt!: string;
  @ApiPropertyOptional({ nullable: true }) loginIp!: string | null;
  @ApiPropertyOptional({ nullable: true }) loginUserAgent!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastRefreshAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) lastRefreshIp!: string | null;
  @ApiProperty() refreshCount!: number;
  @ApiProperty() expiresAt!: string;
  @ApiPropertyOptional({ nullable: true }) logoutAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) logoutReason!: string | null;
  @ApiPropertyOptional({ nullable: true }) logoutIp!: string | null;
  @ApiProperty() active!: boolean;
  @ApiProperty({ description: 'Seconds from login to logout (or to now while open)' })
  durationSeconds!: number;
}
