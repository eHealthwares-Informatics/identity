import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Service-to-service request: find or create the website user that owns a
 * customer's phone number. Used by rxsoft when a customer is created or when a
 * payment link needs a user account.
 */
export class EnsureCustomerUserDto {
  @ApiPropertyOptional({
    description: 'Org scope. Honoured for x-api-key (system) callers only.',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Display name (informational).' })
  @IsOptional()
  @IsString()
  name?: string;
}
