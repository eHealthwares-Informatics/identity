import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export type ProvisionTemplate = 'playwright' | 'standard';

export class ProvisionOrganisationDto {
  @ApiProperty({
    description: 'Organisation code (used for roles, users, price-list codes).',
    example: 'MYPHARM',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'code may only contain letters, digits, underscore and dash',
  })
  code!: string;

  @ApiProperty({
    description: 'Human-readable organisation name.',
    example: 'My Pharmacy',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Provisioning template. Both templates currently provision the same baseline.',
    enum: ['playwright', 'standard'],
    default: 'playwright',
  })
  @IsOptional()
  @IsIn(['playwright', 'standard'])
  template?: ProvisionTemplate;

  @ApiPropertyOptional({
    description:
      'Password for every provisioned user (also the organisation owner). Defaults to "password" so local demos/tests can log in.',
    default: 'password',
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Which global catalogue items to whitelist into the organisation. "all" (default) whitelists every active global item.',
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all'])
  whitelistItems?: 'all';

  @ApiPropertyOptional({
    description: 'Restrict whitelisting to these item codes (when whitelistItems is omitted but items given).',
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  items?: string[];

  @ApiPropertyOptional({
    description: 'Named location for the retail store (defaults to "STORE").',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  storeCode?: string;

  @ApiPropertyOptional({
    description:
      'Email for the organisation owner (admin role). Also used as the login '
      + 'identity — must be globally unique. When provided, the owner username '
      + 'is set to the email.',
    example: 'admin@mypharm.com',
  })
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional({
    description:
      'Username for the organisation owner (admin role). Ignored when ownerEmail is provided. Defaults to "<CODE>_OWNER".',
    example: 'mypharm.admin',
  })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  @Matches(/^[A-Za-z0-9_.-]+$/, {
    message: 'ownerUsername may only contain letters, digits, dot, underscore and dash',
  })
  ownerUsername?: string;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
