import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreateRoleRequestDto {
  @ApiProperty({ example: 'pharmacist' })
  @IsString()
  @Length(1, 64)
  roleCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateRoleRequestDto {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: 'pending' | 'approved' | 'rejected';

  @ApiPropertyOptional({ description: 'Role to assign instead of the requested one' })
  @IsOptional()
  @IsString()
  roleCode?: string;
}