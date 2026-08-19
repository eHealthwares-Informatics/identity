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
}
