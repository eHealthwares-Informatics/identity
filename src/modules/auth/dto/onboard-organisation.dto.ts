import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class OnboardOrganisationDto {
  @ApiProperty({ description: 'Organisation code (also prefixes roles/users).', example: 'MYPHARM' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 40)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'code may only contain letters, digits, underscore and dash',
  })
  code!: string;

  @ApiProperty({ description: 'Human-readable organisation name.', example: 'My Pharmacy' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Password for the organisation owner (and other provisioned users).',
    default: 'password',
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  password?: string;

  @ApiProperty({
    description:
      'Email for the organisation owner (admin role). Also used as the login identity — must be globally unique.',
    example: 'admin@mypharm.com',
  })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  ownerEmail!: string;

  @ApiPropertyOptional({
    description: 'Deprecated. Username for the organisation owner. Ignored when ownerEmail is provided.',
    example: 'mypharm.admin',
  })
  @IsOptional()
  @IsString()
  @Length(2, 60)
  @Matches(/^[A-Za-z0-9_.-]+$/, {
    message: 'ownerUsername may only contain letters, digits, dot, underscore and dash',
  })
  ownerUsername?: string;
}