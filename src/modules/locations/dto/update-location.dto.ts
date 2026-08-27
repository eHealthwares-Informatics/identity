import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLocationDto {
  @ApiPropertyOptional({ example: 'CLINIC-C' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @ApiPropertyOptional({ example: 'Clinic C' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: null, description: 'Parent site location id; pass null to detach from a parent' })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}