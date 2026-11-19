import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Username' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'password', description: 'Password (min 6 characters)' })
  @IsString()
  @MinLength(6)
  password!: string;

  /**
   * Optional tenant scope. Takes precedence over the `x-organization-id`
   * header. Without either, the lookup stays backwards-compatible (global).
   */
  @ApiPropertyOptional({ description: 'Organisation id to scope the login to' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Organisation code to scope the login to' })
  @IsOptional()
  @IsString()
  organizationCode?: string;
}
